import { Hono } from "hono";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, inArray, or, isNull } from "drizzle-orm";
import {
  socialAccount,
  customerGroup,
  workspaceMember,
  workspaceInvite,
  workspace,
  signature,
  postingSet,
  plug,
  rssFeed,
  apiToken,
  outboundWebhook,
  posts,
  postDestination,
  user,
} from "../db/schema";
import type { Env } from "../env";
import { parseEmailSender, sendViaEmailBinding } from "../lib/email-sender";
import { assertWorkspaceAccess, ensureDefaultWorkspace, sha256Hex } from "../lib/workspace";
import {
  assertChannelLimit,
  assertTeamAllowed,
  getWorkspacePlan,
  planErrorResponse,
  usageSnapshot,
} from "../lib/entitlements";
import { NETWORKS, NETWORK_META } from "../lib/networks";
import { fetchInstagramLoginUsername, instagramAccountLabel } from "../lib/oauth-providers";
import { isPlanId } from "../lib/plans";
import { isCloud } from "../lib/dodo";
import { decryptCredentials, decryptSecret, encryptCredentials, encryptSecret } from "../lib/secrets";
import { rssHasPublishTarget } from "../lib/schedule";

export const workspaceRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

async function allChannelsInWorkspace(env: Env, workspaceId: string, channelIds: string[]) {
  const db = drizzle(env.DB);
  for (const id of [...new Set(channelIds)]) {
    const [row] = await db
      .select({ id: socialAccount.id })
      .from(socialAccount)
      .where(and(eq(socialAccount.id, id), eq(socialAccount.workspaceId, workspaceId)))
      .limit(1);
    if (!row) return false;
  }
  return true;
}

workspaceRoutes.get("/me", async (c) => {
  const userId = c.get("userId");
  const ws = await ensureDefaultWorkspace(c.env, userId);
  const db = drizzle(c.env.DB);
  const [member] = await db
    .select({ role: workspaceMember.role })
    .from(workspaceMember)
    .where(and(eq(workspaceMember.workspaceId, ws.id), eq(workspaceMember.userId, userId)))
    .limit(1);
  const usage = await usageSnapshot(c.env, ws.id);
  const role = member?.role && member.role !== "owner" ? member.role : ws.ownerId === userId ? "owner" : "member";
  return c.json({ workspace: { ...ws, role }, usage, networks: NETWORKS, cloud: isCloud(c.env) });
});

workspaceRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const ws = await assertWorkspaceAccess(c.env, id, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  const body = z
    .object({
      name: z.string().min(1).max(80).optional(),
      theme: z.enum(["light", "dark"]).optional(),
      signature: z.string().max(500).nullable().optional(),
      plan: z.string().optional(),
      accountKind: z.enum(["solo", "agency"]).nullable().optional(),
      onboardingCompleted: z.boolean().optional(),
    })
    .parse(await c.req.json());
  const db = drizzle(c.env.DB);
  const patch: Partial<typeof workspace.$inferInsert> = {};
  if (body.name) patch.name = body.name;
  if (body.theme) patch.theme = body.theme;
  if (body.signature !== undefined) patch.signature = body.signature;
  if (body.plan && isPlanId(body.plan) && !isCloud(c.env)) patch.plan = body.plan;
  if (body.accountKind !== undefined) patch.accountKind = body.accountKind;
  if (body.onboardingCompleted !== undefined) patch.onboardingCompleted = body.onboardingCompleted;
  if (Object.keys(patch).length) await db.update(workspace).set(patch).where(eq(workspace.id, id));
  const [next] = await db.select().from(workspace).where(eq(workspace.id, id)).limit(1);
  return c.json({ workspace: next });
});

workspaceRoutes.get("/:id/usage", async (c) => {
  const id = c.req.param("id");
  const ws = await assertWorkspaceAccess(c.env, id, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  return c.json(await usageSnapshot(c.env, id));
});

export const accountRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

accountRoutes.get("/", async (c) => {
  const workspaceId = c.req.query("workspaceId");
  if (!workspaceId) return c.json({ error: "workspaceId required" }, 400);
  const ws = await assertWorkspaceAccess(c.env, workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  const db = drizzle(c.env.DB);
  const rows = await db.select().from(socialAccount).where(eq(socialAccount.workspaceId, workspaceId));
  const problems = await db
    .select({ accountId: postDestination.socialAccountId, error: postDestination.error })
    .from(postDestination)
    .innerJoin(posts, eq(postDestination.postId, posts.id))
    .where(and(eq(posts.workspaceId, workspaceId), inArray(postDestination.status, ["failed", "queued"])));
  const lastError = new Map<string, string>();
  for (const problem of problems) {
    if (problem.error && !lastError.has(problem.accountId)) lastError.set(problem.accountId, problem.error);
  }
  const accounts = await Promise.all(rows.map(async (row) => {
    let handle = row.handle;
    let tokenCipher = await encryptSecret(c.env, await decryptSecret(c.env, row.tokenCipher));
    let credentialsJson = row.credentialsJson;
    let channelId: string | null = null;
    let channelName: string | null = null;
    let pendingPages: Array<{ id: string; name: string }> = [];
    let tokenExpiresAt: number | null = null;
    if (row.credentialsJson) {
      try {
        const creds = await decryptCredentials(c.env, row.credentialsJson);
        const exp = Number(creds?.expiresAt);
        if (Number.isFinite(exp) && exp > 0) tokenExpiresAt = exp;
        if (!creds) throw new Error("missing credentials");
        channelId = creds.channelId || null;
        channelName = creds.channelName || null;
        if (creds.pendingPagesJson) {
          try {
            const raw = JSON.parse(creds.pendingPagesJson) as Array<{
              id?: string;
              name?: string;
              igUserId?: string;
              igUsername?: string;
            }>;
            pendingPages = raw
              .filter((p) => p.id)
              .map((p) => ({
                id: p.id!,
                name:
                  row.network === "instagram"
                    ? instagramAccountLabel(p) || p.id!
                    : p.name || p.id!,
              }));
          } catch {
            pendingPages = [];
          }
        }
        credentialsJson = await encryptCredentials(c.env, creds);
        if (
          row.network === "instagram" &&
          creds.accessToken &&
          /^\d+$/.test(handle.replace(/^@/, ""))
        ) {
          const igUserId = creds.igUserId || row.externalId;
          const username = await fetchInstagramLoginUsername(creds.accessToken, igUserId);
          if (username) {
            handle = `@${username.replace(/^@/, "")}`;
            creds.igUsername = username.replace(/^@/, "");
            credentialsJson = await encryptCredentials(c.env, creds);
            await db
              .update(socialAccount)
              .set({ handle, credentialsJson })
              .where(and(eq(socialAccount.id, row.id), eq(socialAccount.workspaceId, workspaceId)));
          }
        }
      } catch {
        /* ignore */
      }
    }
    if (tokenCipher !== row.tokenCipher || credentialsJson !== row.credentialsJson) {
      await db
        .update(socialAccount)
        .set({ tokenCipher, credentialsJson })
        .where(and(eq(socialAccount.id, row.id), eq(socialAccount.workspaceId, workspaceId)));
    }
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      network: row.network,
      handle,
      externalId: row.externalId,
      groupId: row.groupId,
      status: row.status,
      createdAt: row.createdAt,
      tokenExpiresAt,
      tokenExpired: tokenExpiresAt != null && tokenExpiresAt <= Date.now(),
      lastError: lastError.get(row.id) || null,
      slackChannelId: row.network === "slack" ? channelId : undefined,
      slackChannelName: row.network === "slack" ? channelName : undefined,
      needsSlackChannel: row.network === "slack" && !channelId,
      needsPage: (row.network === "instagram" || row.network === "facebook") && row.status === "needs_page",
      pendingPages: (row.network === "instagram" || row.network === "facebook") && row.status === "needs_page" ? pendingPages : undefined,
    };
  }));
  return c.json({
    accounts,
    networks: NETWORKS,
    meta: Object.fromEntries(NETWORKS.map((n) => [n, NETWORK_META[n]])),
  });
});

accountRoutes.post("/", async (c) => {
  try {
    const body = z
      .object({
        workspaceId: z.string(),
        network: z.enum([
          "linkedin",
          "x",
          "instagram",
          "threads",
          "facebook",
          "youtube",
          "reddit",
          "bluesky",
          "mastodon",
          "hashnode",
          "devto",
          "telegram",
          "discord",
          "slack",
        ]),
        handle: z.string().min(1),
        appPassword: z.string().optional(),
        apiKey: z.string().optional(),
        botToken: z.string().optional(),
        chatId: z.string().optional(),
        webhookUrl: z.string().optional(),
        publicationId: z.string().optional(),
        subreddit: z.string().optional(),
        groupId: z.string().nullable().optional(),
        replaceId: z.string().optional(),
      })
      .parse(await c.req.json());
    const ws = await assertWorkspaceAccess(c.env, body.workspaceId, c.get("userId"));
    if (!ws) return c.json({ error: "forbidden" }, 403);
    const db = drizzle(c.env.DB);
    const [replacing] = body.replaceId
      ? await db
          .select({ id: socialAccount.id })
          .from(socialAccount)
          .where(and(eq(socialAccount.id, body.replaceId), eq(socialAccount.workspaceId, body.workspaceId), eq(socialAccount.network, body.network)))
          .limit(1)
      : [];
    if (body.replaceId && !replacing) return c.json({ error: "replace_not_found" }, 404);
    if (!replacing) await assertChannelLimit(c.env, body.workspaceId, 1);

    const creds: Record<string, string> = {};
    if (body.appPassword) {
      creds.identifier = body.handle;
      creds.appPassword = body.appPassword;
    }
    if (body.apiKey) creds.apiKey = body.apiKey;
    if (body.botToken) creds.botToken = body.botToken;
    if (body.chatId) creds.chatId = body.chatId;
    if (body.webhookUrl) creds.webhookUrl = body.webhookUrl;
    if (body.publicationId) creds.publicationId = body.publicationId;
    if (body.subreddit) creds.subreddit = body.subreddit.trim().replace(/^\/?r\//i, "");

    const secret =
      body.appPassword ||
      body.apiKey ||
      body.botToken ||
      body.webhookUrl ||
      "pending";
    const active = secret !== "pending";

    const tokenCipher = await encryptSecret(c.env, secret);
    const credentialsJson = await encryptCredentials(c.env, creds);
    const status = active ? "active" : "needs_credentials";
    if (replacing) {
      await db
        .update(socialAccount)
        .set({ handle: body.handle, externalId: body.handle, tokenCipher, credentialsJson, groupId: body.groupId ?? null, status })
        .where(eq(socialAccount.id, replacing.id));
      return c.json({ id: replacing.id });
    }
    const id = crypto.randomUUID();
    await db.insert(socialAccount).values({
      id,
      workspaceId: body.workspaceId,
      network: body.network,
      handle: body.handle,
      externalId: body.handle,
      tokenCipher,
      credentialsJson,
      groupId: body.groupId ?? null,
      status,
      createdAt: new Date(),
    });
    return c.json({ id }, 201);
  } catch (e) {
    const pe = planErrorResponse(e);
    if (pe) return pe;
    throw e;
  }
});

accountRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const workspaceId = c.req.query("workspaceId");
  if (!workspaceId) return c.json({ error: "workspaceId required" }, 400);
  const ws = await assertWorkspaceAccess(c.env, workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  const db = drizzle(c.env.DB);
  const owned = await db
    .select({ id: socialAccount.id })
    .from(socialAccount)
    .where(and(eq(socialAccount.id, id), eq(socialAccount.workspaceId, workspaceId)))
    .limit(1);
  if (!owned.length) return c.json({ error: "not_found" }, 404);
  await db.delete(postDestination).where(eq(postDestination.socialAccountId, id));
  await db
    .delete(socialAccount)
    .where(and(eq(socialAccount.id, id), eq(socialAccount.workspaceId, workspaceId)));
  return c.json({ ok: true });
});

accountRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = z
    .object({
      workspaceId: z.string(),
      groupId: z.string().nullable().optional(),
      slackChannelId: z.string().optional(),
      slackChannelName: z.string().optional(),
      pageId: z.string().optional(),
    })
    .parse(await c.req.json());
  const ws = await assertWorkspaceAccess(c.env, body.workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  const db = drizzle(c.env.DB);
  const [row] = await db
    .select()
    .from(socialAccount)
    .where(and(eq(socialAccount.id, id), eq(socialAccount.workspaceId, body.workspaceId)))
    .limit(1);
  if (!row) return c.json({ error: "not_found" }, 404);

  if (body.groupId) {
    const [g] = await db
      .select()
      .from(customerGroup)
      .where(and(eq(customerGroup.id, body.groupId), eq(customerGroup.workspaceId, body.workspaceId)))
      .limit(1);
    if (!g) return c.json({ error: "company_not_found" }, 404);
  }

  const patch: { groupId?: string | null; credentialsJson?: string; status?: string } = {};
  if (body.groupId !== undefined) patch.groupId = body.groupId;

  if (body.slackChannelId) {
    if (row.network !== "slack") return c.json({ error: "not_slack" }, 400);
    let creds: Record<string, string> = {};
    if (row.credentialsJson) {
      try {
        creds = (await decryptCredentials(c.env, row.credentialsJson)) || {};
      } catch {
        creds = {};
      }
    }
    const token = await decryptSecret(c.env, row.tokenCipher);
    if (!creds.botToken && token && token !== "pending") {
      creds.botToken = token;
    }
    creds.channelId = body.slackChannelId;
    if (body.slackChannelName) creds.channelName = body.slackChannelName;
    patch.credentialsJson = (await encryptCredentials(c.env, creds)) ?? undefined;
    patch.status = "active";
  }

  if (body.pageId) {
    if (row.network !== "instagram" && row.network !== "facebook") {
      return c.json({ error: "not_page_network" }, 400);
    }
    let creds: Record<string, string> = {};
    if (row.credentialsJson) {
      try {
        creds = (await decryptCredentials(c.env, row.credentialsJson)) || {};
      } catch {
        creds = {};
      }
    }
    let pages: Array<{
      id: string;
      name: string;
      accessToken: string;
      igUserId?: string;
      igUsername?: string;
    }> = [];
    try {
      pages = creds.pendingPagesJson ? JSON.parse(creds.pendingPagesJson) : [];
    } catch {
      pages = [];
    }
    const picked = pages.find((p) => p.id === body.pageId);
    if (!picked?.accessToken) return c.json({ error: "page_not_found" }, 404);
    if (row.network === "instagram" && !picked.igUserId) {
      return c.json({ error: "no_instagram_account", message: "That Page has no Instagram professional account" }, 400);
    }
    const handle =
      row.network === "instagram"
        ? instagramAccountLabel(picked) || picked.igUserId || "instagram-account"
        : picked.name;
    creds.accessToken = picked.accessToken;
    creds.pageId = picked.id;
    creds.pageName = picked.name;
    if (picked.igUserId) creds.igUserId = picked.igUserId;
    if (picked.igUsername) creds.igUsername = picked.igUsername;
    delete creds.pendingPagesJson;
    patch.credentialsJson = (await encryptCredentials(c.env, creds)) ?? undefined;
    patch.status = "active";
    await db
      .update(socialAccount)
      .set({
        ...patch,
        handle,
        externalId: row.network === "instagram" ? picked.igUserId || picked.id : picked.id,
        tokenCipher: await encryptSecret(c.env, picked.accessToken),
      })
      .where(and(eq(socialAccount.id, id), eq(socialAccount.workspaceId, body.workspaceId)));
    return c.json({ ok: true, pageId: picked.id, handle });
  }

  if (!Object.keys(patch).length) return c.json({ error: "nothing_to_update" }, 400);

  await db
    .update(socialAccount)
    .set(patch)
    .where(and(eq(socialAccount.id, id), eq(socialAccount.workspaceId, body.workspaceId)));
  return c.json({ ok: true, groupId: body.groupId ?? row.groupId, slackChannelId: body.slackChannelId });
});

accountRoutes.get("/:id/slack/channels", async (c) => {
  const id = c.req.param("id");
  const workspaceId = c.req.query("workspaceId");
  if (!workspaceId) return c.json({ error: "workspaceId required" }, 400);
  const ws = await assertWorkspaceAccess(c.env, workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  const db = drizzle(c.env.DB);
  const [row] = await db
    .select()
    .from(socialAccount)
    .where(and(eq(socialAccount.id, id), eq(socialAccount.workspaceId, workspaceId)))
    .limit(1);
  if (!row || row.network !== "slack") return c.json({ error: "not_found" }, 404);

  let botToken = await decryptSecret(c.env, row.tokenCipher);
  if (row.credentialsJson) {
    try {
      const creds = await decryptCredentials(c.env, row.credentialsJson);
      if (!creds) throw new Error("missing credentials");
      if (creds.botToken) botToken = creds.botToken;
    } catch {
      /* ignore */
    }
  }
  if (!botToken || botToken === "pending" || botToken.startsWith("http")) {
    return c.json({ error: "no_bot_token", message: "Slack bot token missing — reconnect with Add to Slack" }, 400);
  }

  const channels: { id: string; name: string; isPrivate: boolean }[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 5; page++) {
    const params = new URLSearchParams({
      types: "public_channel,private_channel",
      exclude_archived: "true",
      limit: "200",
    });
    if (cursor) params.set("cursor", cursor);
    const res = await fetch(`https://slack.com/api/conversations.list?${params}`, {
      headers: { authorization: `Bearer ${botToken}` },
    });
    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      channels?: { id: string; name: string; is_private?: boolean }[];
      response_metadata?: { next_cursor?: string };
    };
    if (!data.ok) {
      return c.json({ error: "slack_api", message: data.error || "conversations.list failed" }, 502);
    }
    for (const ch of data.channels || []) {
      channels.push({ id: ch.id, name: ch.name, isPrivate: !!ch.is_private });
    }
    cursor = data.response_metadata?.next_cursor || undefined;
    if (!cursor) break;
  }

  channels.sort((a, b) => a.name.localeCompare(b.name));
  return c.json({ channels });
});

export const teamRoutes = new Hono<{ Bindings: Env; Variables: { userId: string; email?: string } }>();

teamRoutes.get("/", async (c) => {
  const workspaceId = c.req.query("workspaceId");
  if (!workspaceId) return c.json({ error: "workspaceId required" }, 400);
  const ws = await assertWorkspaceAccess(c.env, workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  const db = drizzle(c.env.DB);
  const members = await db.select().from(workspaceMember).where(eq(workspaceMember.workspaceId, workspaceId));
  const invites = await db.select().from(workspaceInvite).where(eq(workspaceInvite.workspaceId, workspaceId));
  const users = await db.select().from(user);
  const byId = Object.fromEntries(users.map((u) => [u.id, u]));
  return c.json({
    members: members.map((m) => ({ ...m, email: byId[m.userId]?.email, name: byId[m.userId]?.name })),
    invites,
  });
});

teamRoutes.post("/invite", async (c) => {
  try {
    const body = z
      .object({ workspaceId: z.string(), email: z.string().email(), role: z.enum(["member", "admin"]).default("member") })
      .parse(await c.req.json());
    const ws = await assertWorkspaceAccess(c.env, body.workspaceId, c.get("userId"));
    if (!ws) return c.json({ error: "forbidden" }, 403);
    await assertTeamAllowed(c.env, body.workspaceId);
    const db = drizzle(c.env.DB);
    const id = crypto.randomUUID();
    await db.insert(workspaceInvite).values({
      id,
      workspaceId: body.workspaceId,
      email: body.email.toLowerCase(),
      role: body.role,
      status: "pending",
      createdAt: new Date(),
    });
    const acceptUrl = `${c.env.WEB_ORIGIN}/invite/${id}`;
    await sendViaEmailBinding(c.env.EMAIL, {
      to: body.email.toLowerCase(),
      from: parseEmailSender(c.env.EMAIL_FROM),
      subject: `Join ${ws.name} on Duskly`,
      text: `You've been invited to ${ws.name}. Open ${acceptUrl} while signed in as ${body.email.toLowerCase()} to join.`,
      html: `<p>You've been invited to <strong>${ws.name}</strong> on Duskly.</p><p><a href="${acceptUrl}" style="color:#ff5c33">Accept invite</a></p><p>Sign in with <strong>${body.email.toLowerCase()}</strong> (same email OTP path as usual), then open the link.</p>`,
    });
    return c.json({ id, acceptUrl }, 201);
  } catch (e) {
    const pe = planErrorResponse(e);
    if (pe) return pe;
    throw e;
  }
});

teamRoutes.get("/invite/:id", async (c) => {
  const db = drizzle(c.env.DB);
  const [inv] = await db.select().from(workspaceInvite).where(eq(workspaceInvite.id, c.req.param("id"))).limit(1);
  if (!inv || inv.status !== "pending") return c.json({ error: "not_found" }, 404);
  const [ws] = await db.select().from(workspace).where(eq(workspace.id, inv.workspaceId)).limit(1);
  return c.json({ id: inv.id, email: inv.email, workspaceName: ws?.name ?? "Account", status: inv.status });
});

teamRoutes.post("/invite/:id/accept", async (c) => {
  const db = drizzle(c.env.DB);
  const [inv] = await db.select().from(workspaceInvite).where(eq(workspaceInvite.id, c.req.param("id"))).limit(1);
  if (!inv || inv.status !== "pending") return c.json({ error: "not_found" }, 404);
  const email = (c.get("email") || "").toLowerCase();
  if (!email || email !== inv.email.toLowerCase()) {
    return c.json({ error: "email_mismatch", message: `Sign in as ${inv.email} to accept this invite` }, 403);
  }
  const userId = c.get("userId");
  const existing = await db
    .select()
    .from(workspaceMember)
    .where(and(eq(workspaceMember.workspaceId, inv.workspaceId), eq(workspaceMember.userId, userId)))
    .limit(1);
  const role = inv.role === "admin" ? "admin" : "member";
  if (!existing.length) {
    await db.insert(workspaceMember).values({ workspaceId: inv.workspaceId, userId, role });
  } else if (existing[0].role === "owner") {
    const [home] = await db.select({ ownerId: workspace.ownerId }).from(workspace).where(eq(workspace.id, inv.workspaceId)).limit(1);
    if (home && home.ownerId !== userId) {
      await db
        .update(workspaceMember)
        .set({ role })
        .where(and(eq(workspaceMember.workspaceId, inv.workspaceId), eq(workspaceMember.userId, userId)));
    }
  }
  await db.update(workspaceInvite).set({ status: "accepted" }).where(eq(workspaceInvite.id, inv.id));
  return c.json({ ok: true, workspaceId: inv.workspaceId });
});

teamRoutes.delete("/invite/:id", async (c) => {
  const workspaceId = c.req.query("workspaceId");
  if (!workspaceId) return c.json({ error: "workspaceId required" }, 400);
  const ws = await assertWorkspaceAccess(c.env, workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  const db = drizzle(c.env.DB);
  await db
    .delete(workspaceInvite)
    .where(and(eq(workspaceInvite.id, c.req.param("id")), eq(workspaceInvite.workspaceId, workspaceId)));
  return c.json({ ok: true });
});

teamRoutes.delete("/member/:userId", async (c) => {
  const workspaceId = c.req.query("workspaceId");
  if (!workspaceId) return c.json({ error: "workspaceId required" }, 400);
  const ws = await assertWorkspaceAccess(c.env, workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  if (ws.ownerId === c.req.param("userId")) return c.json({ error: "cannot_remove_owner" }, 400);
  const db = drizzle(c.env.DB);
  await db
    .delete(workspaceMember)
    .where(
      and(eq(workspaceMember.workspaceId, workspaceId), eq(workspaceMember.userId, c.req.param("userId"))),
    );
  return c.json({ ok: true });
});

export const orgRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

orgRoutes.get("/groups", async (c) => {
  const workspaceId = c.req.query("workspaceId");
  if (!workspaceId) return c.json({ error: "workspaceId required" }, 400);
  const ws = await assertWorkspaceAccess(c.env, workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  const db = drizzle(c.env.DB);
  const groups = await db.select().from(customerGroup).where(eq(customerGroup.workspaceId, workspaceId));
  const accounts = await db
    .select({ id: socialAccount.id, handle: socialAccount.handle, network: socialAccount.network, groupId: socialAccount.groupId })
    .from(socialAccount)
    .where(eq(socialAccount.workspaceId, workspaceId));
  return c.json({
    groups: groups.map((g) => ({
      ...g,
      accountIds: accounts.filter((a) => a.groupId === g.id).map((a) => a.id),
      accounts: accounts.filter((a) => a.groupId === g.id),
    })),
  });
});

orgRoutes.post("/groups", async (c) => {
  const body = z.object({ workspaceId: z.string(), name: z.string().min(1) }).parse(await c.req.json());
  const ws = await assertWorkspaceAccess(c.env, body.workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  const id = crypto.randomUUID();
  const db = drizzle(c.env.DB);
  await db.insert(customerGroup).values({ id, workspaceId: body.workspaceId, name: body.name, createdAt: new Date() });
  return c.json({ id }, 201);
});

orgRoutes.put("/groups/:id/accounts", async (c) => {
  const body = z
    .object({ workspaceId: z.string(), accountIds: z.array(z.string()) })
    .parse(await c.req.json());
  const ws = await assertWorkspaceAccess(c.env, body.workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  const groupId = c.req.param("id");
  const db = drizzle(c.env.DB);
  const [g] = await db
    .select()
    .from(customerGroup)
    .where(and(eq(customerGroup.id, groupId), eq(customerGroup.workspaceId, body.workspaceId)))
    .limit(1);
  if (!g) return c.json({ error: "not_found" }, 404);
  // Clear membership for this group, then assign selected accounts (workspace-scoped).
  await db
    .update(socialAccount)
    .set({ groupId: null })
    .where(and(eq(socialAccount.workspaceId, body.workspaceId), eq(socialAccount.groupId, groupId)));
  if (body.accountIds.length) {
    await db
      .update(socialAccount)
      .set({ groupId })
      .where(and(eq(socialAccount.workspaceId, body.workspaceId), inArray(socialAccount.id, body.accountIds)));
  }
  return c.json({ ok: true, accountIds: body.accountIds });
});

orgRoutes.delete("/groups/:id/accounts/:accountId", async (c) => {
  const workspaceId = z.string().parse(c.req.query("workspaceId"));
  const ws = await assertWorkspaceAccess(c.env, workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  const db = drizzle(c.env.DB);
  await db
    .update(socialAccount)
    .set({ groupId: null })
    .where(
      and(
        eq(socialAccount.id, c.req.param("accountId")),
        eq(socialAccount.workspaceId, workspaceId),
        eq(socialAccount.groupId, c.req.param("id")),
      ),
    );
  return c.json({ ok: true });
});

orgRoutes.get("/signatures", async (c) => {
  const workspaceId = c.req.query("workspaceId");
  if (!workspaceId) return c.json({ error: "workspaceId required" }, 400);
  const ws = await assertWorkspaceAccess(c.env, workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  const db = drizzle(c.env.DB);
  return c.json({ signatures: await db.select().from(signature).where(eq(signature.workspaceId, workspaceId)) });
});

orgRoutes.post("/signatures", async (c) => {
  const body = z
    .object({ workspaceId: z.string(), name: z.string(), body: z.string(), isDefault: z.boolean().optional() })
    .parse(await c.req.json());
  const ws = await assertWorkspaceAccess(c.env, body.workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  const id = crypto.randomUUID();
  const db = drizzle(c.env.DB);
  if (body.isDefault) {
    await db
      .update(signature)
      .set({ isDefault: false })
      .where(eq(signature.workspaceId, body.workspaceId));
  }
  await db.insert(signature).values({
    id,
    workspaceId: body.workspaceId,
    name: body.name,
    body: body.body,
    isDefault: body.isDefault ?? false,
    createdAt: new Date(),
  });
  return c.json({ id }, 201);
});

orgRoutes.post("/signatures/:id/default", async (c) => {
  const workspaceId = z.string().parse(c.req.query("workspaceId"));
  const ws = await assertWorkspaceAccess(c.env, workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  const db = drizzle(c.env.DB);
  const id = c.req.param("id");
  const [sig] = await db
    .select()
    .from(signature)
    .where(and(eq(signature.id, id), eq(signature.workspaceId, workspaceId)))
    .limit(1);
  if (!sig) return c.json({ error: "not_found" }, 404);
  await db.update(signature).set({ isDefault: false }).where(eq(signature.workspaceId, workspaceId));
  await db.update(signature).set({ isDefault: true }).where(eq(signature.id, id));
  return c.json({ ok: true });
});

orgRoutes.get("/sets", async (c) => {
  const workspaceId = c.req.query("workspaceId");
  if (!workspaceId) return c.json({ error: "workspaceId required" }, 400);
  const ws = await assertWorkspaceAccess(c.env, workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  const db = drizzle(c.env.DB);
  return c.json({ sets: await db.select().from(postingSet).where(eq(postingSet.workspaceId, workspaceId)) });
});

orgRoutes.post("/sets", async (c) => {
  const body = z
    .object({
      workspaceId: z.string(),
      name: z.string(),
      channelIds: z.array(z.string()).min(1),
      templateBody: z.string().optional(),
    })
    .parse(await c.req.json());
  const ws = await assertWorkspaceAccess(c.env, body.workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  if (!(await allChannelsInWorkspace(c.env, body.workspaceId, body.channelIds))) {
    return c.json({ error: "invalid_channel" }, 400);
  }
  const id = crypto.randomUUID();
  const db = drizzle(c.env.DB);
  await db.insert(postingSet).values({
    id,
    workspaceId: body.workspaceId,
    name: body.name,
    channelIds: JSON.stringify(body.channelIds),
    templateBody: body.templateBody ?? null,
    createdAt: new Date(),
  });
  return c.json({ id }, 201);
});

orgRoutes.get("/plugs", async (c) => {
  const workspaceId = c.req.query("workspaceId");
  if (!workspaceId) return c.json({ error: "workspaceId required" }, 400);
  const ws = await assertWorkspaceAccess(c.env, workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  const db = drizzle(c.env.DB);
  const rows = await db
    .select()
    .from(plug)
    .where(
      or(
        and(eq(plug.scope, "internal"), eq(plug.workspaceId, workspaceId)),
        and(eq(plug.scope, "global"), or(isNull(plug.workspaceId), eq(plug.workspaceId, workspaceId))),
      ),
    );
  return c.json({ plugs: rows });
});

orgRoutes.post("/plugs", async (c) => {
  const body = z
    .object({
      workspaceId: z.string().nullable().optional(),
      scope: z.enum(["internal", "global"]),
      name: z.string(),
      triggerType: z.enum(["manual", "on_publish", "schedule"]),
      action: z.object({
        type: z.enum(["create_post"]),
        body: z.string(),
        channelId: z.string().optional(),
        everyMinutes: z.number().int().min(15).max(10080).optional(),
      }),
    })
    .parse(await c.req.json());
  if (body.scope === "internal") {
    if (!body.workspaceId) return c.json({ error: "workspaceId required" }, 400);
    const ws = await assertWorkspaceAccess(c.env, body.workspaceId, c.get("userId"));
    if (!ws) return c.json({ error: "forbidden" }, 403);
    if (body.action.channelId && !(await allChannelsInWorkspace(c.env, body.workspaceId, [body.action.channelId]))) {
      return c.json({ error: "invalid_channel" }, 400);
    }
  }
  const id = crypto.randomUUID();
  const db = drizzle(c.env.DB);
  await db.insert(plug).values({
    id,
    workspaceId: body.scope === "internal" ? body.workspaceId! : body.workspaceId ?? null,
    scope: body.scope,
    name: body.name,
    triggerType: body.triggerType,
    actionJson: JSON.stringify(body.action),
    active: true,
    createdAt: new Date(),
  });
  return c.json({ id }, 201);
});

orgRoutes.post("/plugs/:id/run", async (c) => {
  const workspaceId = z.string().parse(c.req.query("workspaceId"));
  const ws = await assertWorkspaceAccess(c.env, workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  const db = drizzle(c.env.DB);
  const [p] = await db.select().from(plug).where(eq(plug.id, c.req.param("id"))).limit(1);
  if (!p || (!p.active)) return c.json({ error: "not_found" }, 404);
  if (p.scope === "internal" && p.workspaceId !== workspaceId) return c.json({ error: "forbidden" }, 403);
  const action = JSON.parse(p.actionJson) as { type: string; body: string; channelId?: string };
  if (action.type !== "create_post") return c.json({ error: "unsupported" }, 400);
  let channelId = action.channelId;
  if (!channelId) {
    const [ch] = await db.select().from(socialAccount).where(eq(socialAccount.workspaceId, workspaceId)).limit(1);
    channelId = ch?.id;
  }
  if (!channelId) return c.json({ error: "no_channel" }, 400);
  if (!(await allChannelsInWorkspace(c.env, workspaceId, [channelId]))) {
    return c.json({ error: "invalid_channel" }, 400);
  }
  const postId = crypto.randomUUID();
  await db.insert(posts).values({
    id: postId,
    workspaceId,
    authorId: c.get("userId"),
    body: action.body,
    status: "scheduled",
    scheduledAt: new Date(Date.now() + 5 * 60_000),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(postDestination).values({
    id: crypto.randomUUID(),
    postId,
    socialAccountId: channelId,
    status: "pending",
  });
  return c.json({ postId });
});

orgRoutes.get("/rss", async (c) => {
  const workspaceId = c.req.query("workspaceId");
  if (!workspaceId) return c.json({ error: "workspaceId required" }, 400);
  const ws = await assertWorkspaceAccess(c.env, workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  const db = drizzle(c.env.DB);
  return c.json({ feeds: await db.select().from(rssFeed).where(eq(rssFeed.workspaceId, workspaceId)) });
});

orgRoutes.post("/rss", async (c) => {
  const body = z
    .object({
      workspaceId: z.string(),
      url: z.string().url(),
      channelIds: z.array(z.string()).default([]),
      groupId: z.string().nullable().optional(),
    })
    .parse(await c.req.json());
  const ws = await assertWorkspaceAccess(c.env, body.workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  if (!rssHasPublishTarget(body.channelIds, body.groupId)) {
    return c.json({ error: "target_required", message: "Pick at least one channel or a customer group" }, 400);
  }
  if (body.channelIds.length && !(await allChannelsInWorkspace(c.env, body.workspaceId, body.channelIds))) {
    return c.json({ error: "invalid_channel" }, 400);
  }
  if (body.groupId) {
    const db = drizzle(c.env.DB);
    const [group] = await db
      .select({ id: customerGroup.id })
      .from(customerGroup)
      .where(and(eq(customerGroup.id, body.groupId), eq(customerGroup.workspaceId, body.workspaceId)))
      .limit(1);
    if (!group) return c.json({ error: "invalid_group" }, 400);
  }
  const id = crypto.randomUUID();
  const db = drizzle(c.env.DB);
  await db.insert(rssFeed).values({
    id,
    workspaceId: body.workspaceId,
    url: body.url,
    channelIds: JSON.stringify(body.channelIds),
    groupId: body.groupId ?? null,
    active: true,
    createdAt: new Date(),
  });
  return c.json({ id }, 201);
});

function analyticsDayShift(raw: string | undefined): string {
  const tz = Number(raw);
  if (!Number.isInteger(tz) || tz < -840 || tz > 840) return "+0 minutes";
  const minutes = -tz;
  return `${minutes >= 0 ? "+" : ""}${minutes} minutes`;
}

orgRoutes.get("/analytics", async (c) => {
  const workspaceId = c.req.query("workspaceId");
  if (!workspaceId) return c.json({ error: "workspaceId required" }, 400);
  const ws = await assertWorkspaceAccess(c.env, workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);

  const breakdown = await c.env.DB.prepare(
    `SELECT sa.network AS network,
            sa.handle AS handle,
            pd.status AS status,
            date(COALESCE(p.published_at, p.scheduled_at, p.created_at) / 1000, 'unixepoch', ?) AS day,
            COUNT(*) AS c
     FROM post_destination pd
     INNER JOIN posts p ON p.id = pd.post_id
     INNER JOIN social_account sa ON sa.id = pd.social_account_id
     WHERE p.workspace_id = ?
       AND date(COALESCE(p.published_at, p.scheduled_at, p.created_at) / 1000, 'unixepoch', ?) >= ?
       AND date(COALESCE(p.published_at, p.scheduled_at, p.created_at) / 1000, 'unixepoch', ?) <= ?
     GROUP BY sa.network, sa.handle, pd.status, day
     ORDER BY day DESC`,
  )
    .bind(
      analyticsDayShift(c.req.query("tz")),
      workspaceId,
      analyticsDayShift(c.req.query("tz")),
      c.req.query("from") || "1970-01-01",
      analyticsDayShift(c.req.query("tz")),
      c.req.query("to") || "2999-12-31",
    )
    .all<{ network: string; handle: string; status: string; day: string; c: number }>();

  const totalsRow = await c.env.DB.prepare(
    `SELECT COUNT(*) AS posts,
            SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published,
            SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) AS queued,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
            SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft,
            SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) AS scheduled
     FROM posts WHERE workspace_id = ?`,
  )
    .bind(workspaceId)
    .first<{ posts: number; published: number; queued: number; failed: number; draft: number; scheduled: number }>();

  const recentRows = await c.env.DB.prepare(
    `SELECT id, body, status, COALESCE(published_at, scheduled_at, created_at) AS at
     FROM posts WHERE workspace_id = ?
     ORDER BY at DESC
     LIMIT 20`,
  )
    .bind(workspaceId)
    .all<{ id: string; body: string; status: string; at: number | null }>();

  const db = drizzle(c.env.DB);
  const recentIds = (recentRows.results || []).map((row) => row.id);
  const destRows = recentIds.length
    ? await db
        .select({
          postId: postDestination.postId,
          status: postDestination.status,
          error: postDestination.error,
          network: socialAccount.network,
          handle: socialAccount.handle,
        })
        .from(postDestination)
        .innerJoin(socialAccount, eq(postDestination.socialAccountId, socialAccount.id))
        .where(inArray(postDestination.postId, recentIds))
    : [];
  const destByPost = new Map<string, { network: string; handle: string; status: string; error: string | null }[]>();
  for (const dest of destRows) {
    const list = destByPost.get(dest.postId) ?? [];
    list.push({ network: dest.network, handle: dest.handle, status: dest.status, error: dest.error });
    destByPost.set(dest.postId, list);
  }

  const byStatus: Record<string, number> = {
    published: totalsRow?.published ?? 0,
    queued: totalsRow?.queued ?? 0,
    failed: totalsRow?.failed ?? 0,
    draft: totalsRow?.draft ?? 0,
    scheduled: totalsRow?.scheduled ?? 0,
  };
  const byChannel: Record<string, Record<string, number>> = {};
  const byDay: Record<string, number> = {};
  const channelMap = new Map<string, { network: string; handle: string; published: number; queued: number; failed: number; pending: number }>();
  for (const row of breakdown.results || []) {
    byChannel[row.network] ||= {};
    byChannel[row.network][row.status] = (byChannel[row.network][row.status] || 0) + row.c;
    byDay[row.day] = (byDay[row.day] || 0) + row.c;
    const key = `${row.network}\0${row.handle}`;
    const cur = channelMap.get(key) ?? { network: row.network, handle: row.handle, published: 0, queued: 0, failed: 0, pending: 0 };
    if (row.status === "published" || row.status === "queued" || row.status === "failed" || row.status === "pending") cur[row.status] += row.c;
    channelMap.set(key, cur);
  }
  const channels = [...channelMap.values()].sort((a, b) => b.published + b.queued + b.failed + b.pending - (a.published + a.queued + a.failed + a.pending));

  // Network insights only when credentials exist; never invent numbers.
  const networkInsights: { network: string; note: string }[] = [];
  const connected = await db
    .select({ network: socialAccount.network, credentialsJson: socialAccount.credentialsJson, tokenCipher: socialAccount.tokenCipher })
    .from(socialAccount)
    .where(eq(socialAccount.workspaceId, workspaceId));
  for (const a of connected) {
    const hasCreds = !!(a.credentialsJson || (a.tokenCipher && a.tokenCipher !== "pending"));
    if (!hasCreds) {
      networkInsights.push({ network: a.network, note: "credentials missing — local breakdown only" });
      continue;
    }
    // X/LinkedIn analytics APIs need elevated products; Bluesky has no aggregate insights endpoint here.
    networkInsights.push({
      network: a.network,
      note: "connected — using local publish outcomes (provider insights not enabled for this app)",
    });
  }

  return c.json({
    totals: {
      posts: totalsRow?.posts ?? 0,
      published: totalsRow?.published ?? 0,
      byStatus,
    },
    byChannel,
    byDay,
    channels,
    breakdown: breakdown.results || [],
    networkInsights,
    recent: (recentRows.results || []).map((row) => ({
      id: row.id,
      body: row.body,
      status: row.status,
      at: row.at,
      channels: destByPost.get(row.id) ?? [],
    })),
  });
});

orgRoutes.get("/tokens", async (c) => {
  const workspaceId = c.req.query("workspaceId");
  if (!workspaceId) return c.json({ error: "workspaceId required" }, 400);
  const ws = await assertWorkspaceAccess(c.env, workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  const db = drizzle(c.env.DB);
  const rows = await db.select().from(apiToken).where(eq(apiToken.workspaceId, workspaceId));
  return c.json({
    tokens: rows.map(({ tokenHash: _, ...rest }) => rest),
  });
});

orgRoutes.post("/tokens", async (c) => {
  const body = z.object({ workspaceId: z.string(), name: z.string() }).parse(await c.req.json());
  const ws = await assertWorkspaceAccess(c.env, body.workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  const raw = `dk_${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`;
  const hash = await sha256Hex(raw);
  const id = crypto.randomUUID();
  const db = drizzle(c.env.DB);
  await db.insert(apiToken).values({
    id,
    workspaceId: body.workspaceId,
    name: body.name,
    tokenHash: hash,
    tokenPrefix: raw.slice(0, 10),
    createdAt: new Date(),
  });
  return c.json({ id, token: raw, prefix: raw.slice(0, 10) }, 201);
});

orgRoutes.get("/integrations", async (c) => {
  const workspaceId = c.req.query("workspaceId");
  if (!workspaceId) return c.json({ error: "workspaceId required" }, 400);
  const ws = await assertWorkspaceAccess(c.env, workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  const db = drizzle(c.env.DB);
  const rows = await db.select().from(outboundWebhook).where(eq(outboundWebhook.workspaceId, workspaceId));
  return c.json({ integrations: rows.map(({ secret: _, ...rest }) => rest) });
});

orgRoutes.post("/integrations", async (c) => {
  const body = z
    .object({
      workspaceId: z.string(),
      name: z.string(),
      url: z.string().url(),
      events: z.array(z.string()).default(["post.published"]),
    })
    .parse(await c.req.json());
  const ws = await assertWorkspaceAccess(c.env, body.workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  const id = crypto.randomUUID();
  const secret = crypto.randomUUID().replace(/-/g, "");
  const db = drizzle(c.env.DB);
  await db.insert(outboundWebhook).values({
    id,
    workspaceId: body.workspaceId,
    name: body.name,
    url: body.url,
    secret,
    events: JSON.stringify(body.events),
    active: true,
    createdAt: new Date(),
  });
  return c.json({ id, secret }, 201);
});
