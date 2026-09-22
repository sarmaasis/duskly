import { Hono } from "hono";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
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
import { assertWorkspaceAccess, ensureDefaultWorkspace, sha256Hex } from "../lib/workspace";
import {
  assertChannelLimit,
  assertTeamAllowed,
  getWorkspacePlan,
  planErrorResponse,
  usageSnapshot,
} from "../lib/entitlements";
import { NETWORKS } from "../lib/networks";
import { isPlanId } from "../lib/plans";
import { isCloud } from "../lib/dodo";

export const workspaceRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

workspaceRoutes.get("/me", async (c) => {
  const ws = await ensureDefaultWorkspace(c.env, c.get("userId"));
  const usage = await usageSnapshot(c.env, ws.id);
  return c.json({ workspace: ws, usage, networks: NETWORKS, cloud: isCloud(c.env) });
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
    })
    .parse(await c.req.json());
  const db = drizzle(c.env.DB);
  const patch: Partial<typeof workspace.$inferInsert> = {};
  if (body.name) patch.name = body.name;
  if (body.theme) patch.theme = body.theme;
  if (body.signature !== undefined) patch.signature = body.signature;
  if (body.plan && isPlanId(body.plan) && !isCloud(c.env)) patch.plan = body.plan;
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
  return c.json({ accounts: rows, networks: NETWORKS });
});

accountRoutes.post("/", async (c) => {
  try {
    const body = z
      .object({
        workspaceId: z.string(),
        network: z.enum(["x", "bluesky", "linkedin", "mastodon"]),
        handle: z.string().min(1),
        appPassword: z.string().optional(),
        groupId: z.string().nullable().optional(),
      })
      .parse(await c.req.json());
    const ws = await assertWorkspaceAccess(c.env, body.workspaceId, c.get("userId"));
    if (!ws) return c.json({ error: "forbidden" }, 403);
    await assertChannelLimit(c.env, body.workspaceId, 1);
    const id = crypto.randomUUID();
    const db = drizzle(c.env.DB);
    const creds = body.appPassword
      ? JSON.stringify({ identifier: body.handle, appPassword: body.appPassword })
      : null;
    await db.insert(socialAccount).values({
      id,
      workspaceId: body.workspaceId,
      network: body.network,
      handle: body.handle,
      externalId: body.handle,
      tokenCipher: body.appPassword || "pending",
      credentialsJson: creds,
      groupId: body.groupId ?? null,
      status: body.appPassword ? "active" : "needs_credentials",
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
  await db
    .delete(socialAccount)
    .where(and(eq(socialAccount.id, id), eq(socialAccount.workspaceId, workspaceId)));
  return c.json({ ok: true });
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
    await c.env.EMAIL.send({
      to: body.email.toLowerCase(),
      from: c.env.EMAIL_FROM,
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
  return c.json({ id: inv.id, email: inv.email, workspaceName: ws?.name ?? "Workspace", status: inv.status });
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
  if (!existing.length) {
    await db.insert(workspaceMember).values({
      workspaceId: inv.workspaceId,
      userId,
      role: inv.role,
    });
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
  return c.json({ groups: await db.select().from(customerGroup).where(eq(customerGroup.workspaceId, workspaceId)) });
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
  const rows = await db.select().from(plug);
  return c.json({
    plugs: rows.filter((p) => p.scope === "global" || p.workspaceId === workspaceId),
  });
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
    .object({ workspaceId: z.string(), url: z.string().url(), channelIds: z.array(z.string()).min(1) })
    .parse(await c.req.json());
  const ws = await assertWorkspaceAccess(c.env, body.workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  const id = crypto.randomUUID();
  const db = drizzle(c.env.DB);
  await db.insert(rssFeed).values({
    id,
    workspaceId: body.workspaceId,
    url: body.url,
    channelIds: JSON.stringify(body.channelIds),
    active: true,
    createdAt: new Date(),
  });
  return c.json({ id }, 201);
});

orgRoutes.get("/analytics", async (c) => {
  const workspaceId = c.req.query("workspaceId");
  if (!workspaceId) return c.json({ error: "workspaceId required" }, 400);
  const ws = await assertWorkspaceAccess(c.env, workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  const db = drizzle(c.env.DB);
  const all = await db.select().from(posts).where(eq(posts.workspaceId, workspaceId));
  const byStatus: Record<string, number> = {};
  for (const p of all) byStatus[p.status] = (byStatus[p.status] || 0) + 1;
  const published = all.filter((p) => p.status === "published");
  return c.json({
    totals: { posts: all.length, published: published.length, byStatus },
    recent: all.slice(0, 20).map((p) => ({ id: p.id, status: p.status, scheduledAt: p.scheduledAt, publishedAt: p.publishedAt })),
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
