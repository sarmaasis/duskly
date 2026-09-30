import { Hono } from "hono";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc, inArray, ne, or } from "drizzle-orm";
import { pageArgs, pageNext } from "../lib/page";
import {
  media,
  posts,
  postDestination,
  socialAccount,
  signature as signatureTable,
  postingSet,
  workspace,
  shortLink,
} from "../db/schema";
import type { Env } from "../env";
import { assertWorkspaceAccess, readCompanyFilter, workspaceRole } from "../lib/workspace";
import { planErrorResponse } from "../lib/entitlements";
import { expandRepeatTimes, rewriteShortLinks, scheduleStatus } from "../lib/schedule";
import { apiPublicOrigin } from "../lib/media-signed-url";
import { isImageMedia, isVideoMedia } from "../lib/networks";
import { channelIssues, imageSize, type ChannelMedia } from "../../../web/src/app/lib/channel-checks";
import { signPublicMediaUrl } from "../lib/media-signed-url";
import { captureProfilePicture, displayAvatarUrl } from "../lib/account-avatar";
import { decryptCredentials } from "../lib/secrets";

export const createPost = z.object({
  workspaceId: z.string(),
  body: z.string().min(1).max(5000),
  scheduledAt: z.number().optional(),
  destinations: z.array(z.string()).default([]),
  status: z.enum(["draft", "scheduled"]).default("draft"),
  mediaIds: z.array(z.string()).max(20).optional(),
  signatureId: z.string().optional().nullable(),
  delaySeconds: z.number().int().min(0).max(86400).optional(),
  repeatRule: z.enum(["none", "daily", "weekly", "interval"]).optional(),
  repeatEveryDays: z.number().int().min(1).max(90).optional(),
  repeatUntil: z.number().optional().nullable(),
  postingSetId: z.string().optional().nullable(),
  commentBody: z.string().max(2000).optional().nullable(),
  commentDelaySeconds: z.number().int().min(0).max(86400).optional(),
  variants: z.record(z.string(), z.string().max(5000)).optional(),
  extras: z
    .object({
      poll: z.object({ question: z.string().max(280), options: z.array(z.string().min(1).max(80)).min(2).max(4) }).optional(),
      thread: z.array(z.string().min(1).max(500)).max(10).optional(),
      postType: z.enum(["post", "story", "reel", "short", "video"]).optional(),
      coverId: z.string().optional(),
      tags: z.array(z.string().max(40)).max(12).optional(),
      alts: z.record(z.string(), z.string().max(1000)).optional(),
      collaborators: z.array(z.string().max(40)).max(3).optional(),
      trialReel: z.boolean().optional(),
      reelAudio: z.string().max(80).optional(),
      replySettings: z.enum(["everyone", "following", "mentionedUsers"]).optional(),
      communityId: z.string().max(40).optional(),
      linkedinCarousel: z.boolean().optional(),
      madeForKids: z.boolean().optional(),
      shortLink: z.boolean().optional(),
    })
    .optional(),
});

function copiedExtras(raw: string | null) {
  try {
    const parsed = JSON.parse(raw || "{}") as { previewToken?: string };
    delete parsed.previewToken;
    return parsed;
  } catch {
    return undefined;
  }
}

function extrasJson(
  extras?: {
    poll?: { question: string; options: string[] };
    thread?: string[];
    postType?: string;
    coverId?: string;
    tags?: string[];
    alts?: Record<string, string>;
    previewToken?: string;
  },
  previous?: string | null,
) {
  let token: string = crypto.randomUUID();
  if (previous) {
    try {
      const parsed = JSON.parse(previous) as { previewToken?: string };
      if (parsed.previewToken) token = parsed.previewToken;
    } catch {
      /* new token */
    }
  }
  return JSON.stringify({ ...(extras || {}), previewToken: token });
}

export const postRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

async function validateWorkspaceRefs(env: Env, workspaceId: string, destinations: string[], mediaIds: string[] = []) {
  const db = drizzle(env.DB);
  const uniqueDestinations = [...new Set(destinations)];
  for (const id of uniqueDestinations) {
    const [row] = await db
      .select({ id: socialAccount.id })
      .from(socialAccount)
      .where(and(eq(socialAccount.id, id), eq(socialAccount.workspaceId, workspaceId)))
      .limit(1);
    if (!row) return { error: "invalid_destination", id };
  }
  for (const id of [...new Set(mediaIds)]) {
    const [row] = await db
      .select({ id: media.id })
      .from(media)
      .where(and(eq(media.id, id), eq(media.workspaceId, workspaceId)))
      .limit(1);
    if (!row) return { error: "invalid_media", id };
  }
  return null;
}

async function validateNetworkMediaRules(
  env: Env,
  workspaceId: string,
  destinations: string[],
  mediaIds: string[] = [],
) {
  const db = drizzle(env.DB);
  const destinationRows = destinations.length
    ? await db
        .select({ network: socialAccount.network })
        .from(socialAccount)
        .where(and(eq(socialAccount.workspaceId, workspaceId), inArray(socialAccount.id, destinations)))
    : [];
  if (!destinationRows.some((d) => d.network === "instagram")) return null;
  if (!mediaIds.length) {
    return {
      error: "instagram_image_required",
      message: "Instagram feed posts require an attached image.",
    };
  }
  const mediaRows = await db.select().from(media).where(and(eq(media.workspaceId, workspaceId), inArray(media.id, mediaIds)));
  if (!mediaRows.some(isImageMedia)) {
    return {
      error: "instagram_image_required",
      message: "Instagram feed posts require an attached image. Video-only Instagram posts are not wired yet.",
    };
  }
  return null;
}

function readStoredIds(raw: string | null) {
  try {
    const value = raw ? JSON.parse(raw) : [];
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function readStoredExtras(raw: string | null) {
  try {
    return JSON.parse(raw || "{}") as { postType?: string; poll?: { options?: string[] } };
  } catch {
    return {};
  }
}

function readStoredVariants(raw: string | null) {
  try {
    const value = raw ? JSON.parse(raw) : {};
    return value && typeof value === "object" ? (value as Record<string, string>) : {};
  } catch {
    return {};
  }
}

async function fitExistingPost(env: Env, post: { id: string; workspaceId: string; body: string; mediaIds: string | null; extrasJson: string | null; variantsJson: string | null }) {
  const db = drizzle(env.DB);
  const destRows = await db
    .select({ id: socialAccount.id, network: socialAccount.network })
    .from(postDestination)
    .innerJoin(socialAccount, eq(postDestination.socialAccountId, socialAccount.id))
    .where(eq(postDestination.postId, post.id));
  const extras = readStoredExtras(post.extrasJson);
  return validateChannelFit(env, post.workspaceId, destRows, readStoredIds(post.mediaIds), post.body, extras.postType, !!extras.poll, readStoredVariants(post.variantsJson));
}

async function channelMedia(env: Env, workspaceId: string, mediaIds: string[], networks: string[]): Promise<ChannelMedia[]> {
  if (!mediaIds.length) return [];
  const db = drizzle(env.DB);
  const rows = await db.select().from(media).where(and(eq(media.workspaceId, workspaceId), inArray(media.id, [...new Set(mediaIds)])));
  const byId = new Map(rows.map((row) => [row.id, row]));
  const needSize = networks.includes("instagram");
  const out: ChannelMedia[] = [];
  for (const id of mediaIds) {
    const row = byId.get(id);
    if (!row) continue;
    const kind = isVideoMedia(row) ? "video" : "image";
    let width: number | undefined;
    let height: number | undefined;
    if (needSize && kind === "image" && row.bytes > 0 && row.bytes <= 8 * 1024 * 1024) {
      const obj = await env.MEDIA.get(row.r2Key);
      if (obj) {
        const size = imageSize(await obj.arrayBuffer());
        if (size?.width && size.height) {
          width = size.width;
          height = size.height;
        }
      }
    }
    out.push({ kind, contentType: row.contentType, bytes: row.bytes, width, height });
  }
  return out;
}

async function validateChannelFit(
  env: Env,
  workspaceId: string,
  destinations: { id: string; network: string }[],
  mediaIds: string[],
  body: string,
  postType: string | undefined,
  hasPoll: boolean,
  variants: Record<string, string> = {},
) {
  if (!destinations.length) return null;
  const attached = await channelMedia(env, workspaceId, mediaIds, destinations.map((row) => row.network));
  const messages = destinations.flatMap((row) =>
    channelIssues({
      network: row.network,
      body: variants[row.id]?.trim() || body,
      postType,
      hasPoll,
      media: attached,
    }),
  );
  const unique = [...new Set(messages)];
  if (!unique.length) return null;
  return { error: "channel_rejected", message: unique.join(" ") };
}

postRoutes.get("/", async (c) => {
  const workspaceId = c.req.query("workspaceId");
  if (!workspaceId) return c.json({ error: "workspaceId required" }, 400);
  const ws = await assertWorkspaceAccess(c.env, workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  const company = await readCompanyFilter(c.env, workspaceId, c.get("userId"), c.req.query("groupId"));
  if ("error" in company) return c.json({ error: company.error }, company.error === "forbidden" ? 403 : 404);
  const db = drizzle(c.env.DB);
  const onlyId = c.req.query("id");
  const { limit, offset } = pageArgs(c.req.query("limit"), c.req.query("offset"));
  let where = onlyId
    ? and(eq(posts.workspaceId, workspaceId), eq(posts.id, onlyId))
    : c.req.query("issues") === "1"
      ? and(eq(posts.workspaceId, workspaceId), inArray(posts.status, ["queued", "failed"]))
      : eq(posts.workspaceId, workspaceId);
  if (company.groupId) {
    const matched = await db
      .select({ id: posts.id })
      .from(posts)
      .innerJoin(postDestination, eq(postDestination.postId, posts.id))
      .innerJoin(socialAccount, eq(postDestination.socialAccountId, socialAccount.id))
      .where(and(eq(posts.workspaceId, workspaceId), eq(socialAccount.groupId, company.groupId)));
    const allowed = [...new Set(matched.map((row) => row.id))];
    if (!allowed.length) return c.json({ posts: [], next: null });
    where = and(where, inArray(posts.id, allowed));
  }
  const selected = await db.select().from(posts).where(where).orderBy(desc(posts.scheduledAt), desc(posts.id)).limit(onlyId ? 1 : limit + 1).offset(onlyId ? 0 : offset);
  const { rows, next } = onlyId ? { rows: selected, next: null } : pageNext(selected, limit, offset);
  const ids = rows.map((row) => row.id);
  const issuesByPost = new Map<string, { network: string; handle: string; status: string; error: string | null }[]>();
  const channelsByPost = new Map<string, { accountId: string; network: string; handle: string; status: string; avatarUrl: string | null }[]>();
  const mediaIdsByPost = new Map<string, string[]>();
  const mediaIdSet = new Set<string>();
  for (const row of rows) {
    let parsed: string[] = [];
    try {
      const value = row.mediaIds ? JSON.parse(row.mediaIds) : [];
      if (Array.isArray(value)) parsed = value.filter((id): id is string => typeof id === "string");
    } catch {
      parsed = [];
    }
    mediaIdsByPost.set(row.id, parsed);
    for (const id of parsed) mediaIdSet.add(id);
  }
  if (ids.length) {
    const dests = await db
      .select({
        postId: postDestination.postId,
        status: postDestination.status,
        error: postDestination.error,
        accountId: socialAccount.id,
        network: socialAccount.network,
        handle: socialAccount.handle,
        avatarUrl: socialAccount.avatarUrl,
      })
      .from(postDestination)
      .innerJoin(socialAccount, eq(postDestination.socialAccountId, socialAccount.id))
      .where(inArray(postDestination.postId, ids));
    for (const dest of dests) {
      const channels = channelsByPost.get(dest.postId) ?? [];
      channels.push({
        accountId: dest.accountId,
        network: dest.network,
        handle: dest.handle,
        status: dest.status,
        avatarUrl: dest.avatarUrl,
      });
      channelsByPost.set(dest.postId, channels);
      if (dest.status !== "queued" && dest.status !== "failed") continue;
      const list = issuesByPost.get(dest.postId) ?? [];
      list.push({
        network: dest.network,
        handle: dest.handle,
        status: dest.status,
        error: dest.error,
      });
      issuesByPost.set(dest.postId, list);
    }
    await fillMissingAvatars(c.env, db, channelsByPost);
  }
  const skipPreview = c.req.query("issues") === "1";
  const mediaRows = !skipPreview && mediaIdSet.size
    ? await db
        .select({ id: media.id, kind: media.kind })
        .from(media)
        .where(and(eq(media.workspaceId, workspaceId), inArray(media.id, [...mediaIdSet])))
    : [];
  const mediaById = new Map(mediaRows.map((row) => [row.id, row]));
  const postsOut = await Promise.all(
    rows.map(async (row) => {
      const attached = (mediaIdsByPost.get(row.id) ?? [])
        .map((id) => mediaById.get(id))
        .filter((item): item is (typeof mediaRows)[number] => !!item);
      const previewSource = skipPreview ? undefined : attached.find((item) => item.kind !== "video") ?? attached[0];
      const preview = previewSource
        ? { id: previewSource.id, kind: previewSource.kind, url: await signPublicMediaUrl(c.env, previewSource.id) }
        : null;
      const channels = await Promise.all(
        (channelsByPost.get(row.id) ?? []).map(async (channel) => ({
          ...channel,
          avatarUrl: await displayAvatarUrl(c.env, channel.accountId, channel.avatarUrl),
        })),
      );
      return { ...row, issues: issuesByPost.get(row.id) ?? [], channels, preview };
    }),
  );
  return c.json({ posts: postsOut, next });
});

postRoutes.post("/", async (c) => {
  try {
    const body = createPost.parse(await c.req.json());
    const ws = await assertWorkspaceAccess(c.env, body.workspaceId, c.get("userId"));
    if (!ws) return c.json({ error: "forbidden" }, 403);
    const db = drizzle(c.env.DB);

    let destinations = body.destinations;
    let postBody = body.body;
    if (body.extras?.shortLink) {
      const rewritten = rewriteShortLinks(postBody, apiPublicOrigin(c.env));
      postBody = rewritten.body;
      for (const pair of rewritten.pairs) {
        await db.insert(shortLink).values({
          code: pair.code,
          workspaceId: body.workspaceId,
          url: pair.url,
          createdAt: new Date(),
        });
      }
    }
    if (body.postingSetId) {
      const [set] = await db
        .select()
        .from(postingSet)
        .where(and(eq(postingSet.id, body.postingSetId), eq(postingSet.workspaceId, body.workspaceId)))
        .limit(1);
      if (set) {
        destinations = JSON.parse(set.channelIds) as string[];
        if (set.templateBody && !body.body.trim()) postBody = set.templateBody;
      }
    }
    if (!destinations.length) return c.json({ error: "destinations_required" }, 400);
    const mediaToCheck = [...(body.mediaIds ?? [])];
    if (body.extras?.coverId) mediaToCheck.push(body.extras.coverId);
    const invalid = await validateWorkspaceRefs(c.env, body.workspaceId, destinations, mediaToCheck);
    if (invalid) return c.json(invalid, 400);
    const mediaRule = await validateNetworkMediaRules(c.env, body.workspaceId, destinations, body.mediaIds);
    if (mediaRule) return c.json(mediaRule, 400);

    let appliedSignatureId = body.signatureId ?? null;
    if (body.signatureId) {
      const [sig] = await db
        .select()
        .from(signatureTable)
        .where(and(eq(signatureTable.id, body.signatureId), eq(signatureTable.workspaceId, body.workspaceId)))
        .limit(1);
      if (sig) postBody = `${postBody.trim()}\n\n${sig.body}`;
    } else {
      const [def] = await db
        .select()
        .from(signatureTable)
        .where(and(eq(signatureTable.workspaceId, body.workspaceId), eq(signatureTable.isDefault, true)))
        .limit(1);
      if (def) {
        postBody = `${postBody.trim()}\n\n${def.body}`;
        appliedSignatureId = def.id;
      } else if (ws.signature) {
        postBody = `${postBody.trim()}\n\n${ws.signature}`;
      }
    }
    if (body.scheduledAt || body.status === "scheduled") {
      const destRows = await db
        .select({ id: socialAccount.id, network: socialAccount.network })
        .from(socialAccount)
        .where(and(eq(socialAccount.workspaceId, body.workspaceId), inArray(socialAccount.id, destinations)));
      const fit = await validateChannelFit(
        c.env,
        body.workspaceId,
        destRows,
        body.mediaIds ?? [],
        postBody,
        body.extras?.postType,
        !!body.extras?.poll,
        body.variants,
      );
      if (fit) return c.json(fit, 400);
    }

    const id = crypto.randomUUID();
    const now = Date.now();
    const delay = body.delaySeconds ?? 0;
    const role = (await workspaceRole(c.env, body.workspaceId, c.get("userId"))) || "member";
    const storedStatus = scheduleStatus(role, body.scheduledAt || body.status === "scheduled" ? "scheduled" : "draft");
    const packed = extrasJson(body.extras);
    const scheduledAt = body.scheduledAt
      ? new Date(body.scheduledAt + delay * 1000)
      : body.status === "scheduled"
        ? new Date(now + delay * 1000)
        : null;

    await db.insert(posts).values({
      id,
      workspaceId: body.workspaceId,
      authorId: c.get("userId"),
      body: postBody,
      status: storedStatus,
      scheduledAt,
      mediaIds: body.mediaIds?.length ? JSON.stringify(body.mediaIds) : null,
      signatureId: appliedSignatureId,
      delaySeconds: delay,
      repeatRule: body.repeatRule && body.repeatRule !== "none" ? body.repeatRule : null,
      repeatUntil: body.repeatUntil ? new Date(body.repeatUntil) : null,
      postingSetId: body.postingSetId ?? null,
      commentBody: body.commentBody ?? null,
      commentDelaySeconds: body.commentDelaySeconds ?? 0,
      variantsJson: body.variants && Object.keys(body.variants).length ? JSON.stringify(body.variants) : null,
      extrasJson: packed,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    });

    for (const socialAccountId of destinations) {
      await db.insert(postDestination).values({
        id: crypto.randomUUID(),
        postId: id,
        socialAccountId,
        status: "pending",
      });
    }

    if (body.repeatRule && body.repeatRule !== "none" && scheduledAt && body.repeatUntil) {
      for (const next of expandRepeatTimes(scheduledAt.getTime(), body.repeatRule, body.repeatUntil, 52, body.repeatEveryDays || 1)) {
        const rid = crypto.randomUUID();
        await db.insert(posts).values({
          id: rid,
          workspaceId: body.workspaceId,
          authorId: c.get("userId"),
          body: postBody,
          status: storedStatus === "pending_approval" ? "pending_approval" : "scheduled",
          scheduledAt: new Date(next),
          extrasJson: extrasJson(body.extras),
          mediaIds: body.mediaIds?.length ? JSON.stringify(body.mediaIds) : null,
          signatureId: appliedSignatureId,
          delaySeconds: 0,
          repeatRule: null,
          parentPostId: id,
          postingSetId: body.postingSetId ?? null,
          commentBody: body.commentBody ?? null,
          commentDelaySeconds: body.commentDelaySeconds ?? 0,
          createdAt: new Date(now),
          updatedAt: new Date(now),
        });
        for (const socialAccountId of destinations) {
          await db.insert(postDestination).values({
            id: crypto.randomUUID(),
            postId: rid,
            socialAccountId,
            status: "pending",
          });
        }
      }
    }

    return c.json({ id }, 201);
  } catch (e) {
    const pe = planErrorResponse(e);
    if (pe) return pe;
    throw e;
  }
});

postRoutes.post("/:id/queue-now", async (c) => {
  const id = c.req.param("id");
  const db = drizzle(c.env.DB);
  const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!post) return c.json({ error: "not_found" }, 404);
  const ws = await assertWorkspaceAccess(c.env, post.workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  if (post.status === "pending_approval") return c.json({ error: "needs_approval", message: "An admin has to approve this before it can publish." }, 409);
  if (post.status !== "draft" && post.status !== "scheduled" && post.status !== "failed" && post.status !== "queued") {
    return c.json({ error: "locked" }, 409);
  }
  if (post.status === "failed" || post.status === "queued") {
    await db
      .update(postDestination)
      .set({ status: "pending", error: null })
      .where(and(eq(postDestination.postId, id), ne(postDestination.status, "published")));
  }
  const queued = await fitExistingPost(c.env, post);
  if (queued) return c.json(queued, 400);
  await db.update(posts).set({ status: "queued", updatedAt: new Date() }).where(eq(posts.id, id));
  await c.env.PUBLISH.send({ postId: id });
  return c.json({ ok: true });
});

const patchPost = z.object({
  body: z.string().min(1).max(5000).optional(),
  scheduledAt: z.number().nullable().optional(),
  destinations: z.array(z.string()).optional(),
  variants: z.record(z.string(), z.string().max(5000)).optional(),
  mediaIds: z.array(z.string()).max(20).optional(),
  status: z.enum(["draft", "scheduled"]).optional(),
  extras: createPost.shape.extras,
});

postRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = patchPost.parse(await c.req.json());
  const db = drizzle(c.env.DB);
  const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!post) return c.json({ error: "not_found" }, 404);
  const ws = await assertWorkspaceAccess(c.env, post.workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  if (post.status !== "draft" && post.status !== "scheduled" && post.status !== "pending_approval") {
    return c.json({ error: "locked", message: "Only a draft or scheduled post can be edited." }, 409);
  }
  const mediaToCheck = [...(body.mediaIds ?? [])];
  if (body.extras?.coverId) mediaToCheck.push(body.extras.coverId);
  if (body.destinations || mediaToCheck.length) {
    const invalid = await validateWorkspaceRefs(c.env, post.workspaceId, body.destinations ?? [], mediaToCheck);
    if (invalid) return c.json(invalid, 400);
  }
  const scheduling = body.status === "scheduled" || typeof body.scheduledAt === "number" || post.status === "scheduled" || post.status === "pending_approval";
  if (scheduling) {
    const destIds = body.destinations ?? (
      await db.select({ id: postDestination.socialAccountId }).from(postDestination).where(eq(postDestination.postId, id))
    ).map((row) => row.id);
    const destRows = destIds.length
      ? await db
          .select({ id: socialAccount.id, network: socialAccount.network })
          .from(socialAccount)
          .where(and(eq(socialAccount.workspaceId, post.workspaceId), inArray(socialAccount.id, destIds)))
      : [];
    const extras = body.extras ?? readStoredExtras(post.extrasJson);
    const fit = await validateChannelFit(
      c.env,
      post.workspaceId,
      destRows,
      body.mediaIds ?? readStoredIds(post.mediaIds),
      body.body ?? post.body,
      extras.postType,
      !!extras.poll,
      body.variants ?? readStoredVariants(post.variantsJson),
    );
    if (fit) return c.json(fit, 400);
  }
  const role = (await workspaceRole(c.env, post.workspaceId, c.get("userId"))) || "member";
  let nextStatus = body.status ?? (body.scheduledAt ? "scheduled" : post.status);
  if (nextStatus === "scheduled" || nextStatus === "pending_approval") nextStatus = scheduleStatus(role, "scheduled");
  await db
    .update(posts)
    .set({
      body: body.body ?? post.body,
      status: nextStatus,
      scheduledAt: body.scheduledAt === undefined ? post.scheduledAt : body.scheduledAt == null ? null : new Date(body.scheduledAt),
      variantsJson: body.variants ? JSON.stringify(body.variants) : post.variantsJson,
      mediaIds: body.mediaIds ? JSON.stringify(body.mediaIds) : post.mediaIds,
      extrasJson: body.extras ? extrasJson(body.extras, post.extrasJson) : post.extrasJson,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, id));
  if (body.destinations) {
    await db.delete(postDestination).where(eq(postDestination.postId, id));
    for (const socialAccountId of [...new Set(body.destinations)]) {
      await db.insert(postDestination).values({
        id: crypto.randomUUID(),
        postId: id,
        socialAccountId,
        status: "pending",
      });
    }
  }
  return c.json({ ok: true });
});

postRoutes.post("/import", async (c) => {
  const body = z
    .object({
      workspaceId: z.string(),
      csv: z.string().min(1).max(100_000),
      destinations: z.array(z.string()).min(1),
    })
    .parse(await c.req.json());
  const ws = await assertWorkspaceAccess(c.env, body.workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  const invalid = await validateWorkspaceRefs(c.env, body.workspaceId, body.destinations, []);
  if (invalid) return c.json(invalid, 400);
  const role = (await workspaceRole(c.env, body.workspaceId, c.get("userId"))) || "member";
  const db = drizzle(c.env.DB);
  const lines = body.csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const start = /^(body|caption)\|/i.test(lines[0] || "") ? 1 : 0;
  const ids: string[] = [];
  for (const line of lines.slice(start, start + 50)) {
    const [text, when] = line.split("|").map((part) => part.trim());
    if (!text) continue;
    const at = when ? Date.parse(when) : NaN;
    const id = crypto.randomUUID();
    const status = Number.isFinite(at) ? scheduleStatus(role, "scheduled") : "draft";
    const now = new Date();
    await db.insert(posts).values({
      id,
      workspaceId: body.workspaceId,
      authorId: c.get("userId"),
      body: text,
      status,
      scheduledAt: Number.isFinite(at) ? new Date(at) : null,
      extrasJson: extrasJson(undefined),
      createdAt: now,
      updatedAt: now,
    });
    for (const socialAccountId of body.destinations) {
      await db.insert(postDestination).values({ id: crypto.randomUUID(), postId: id, socialAccountId, status: "pending" });
    }
    ids.push(id);
  }
  return c.json({ ids }, 201);
});

postRoutes.post("/:id/pause", async (c) => {
  const id = c.req.param("id");
  const db = drizzle(c.env.DB);
  const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!post) return c.json({ error: "not_found" }, 404);
  const ws = await assertWorkspaceAccess(c.env, post.workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  const root = post.parentPostId || post.id;
  const series = await db
    .select({ id: posts.id, status: posts.status })
    .from(posts)
    .where(or(eq(posts.id, root), eq(posts.parentPostId, root)));
  const hold = series.filter((row) => row.status === "scheduled" || row.status === "pending_approval").map((row) => row.id);
  if (hold.length) {
    await db.update(posts).set({ status: "draft", updatedAt: new Date() }).where(inArray(posts.id, hold));
  }
  return c.json({ paused: hold.length });
});

postRoutes.post("/:id/decide", async (c) => {
  const id = c.req.param("id");
  const body = z.object({ action: z.enum(["approve", "return"]) }).parse(await c.req.json());
  const db = drizzle(c.env.DB);
  const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!post) return c.json({ error: "not_found" }, 404);
  const role = await workspaceRole(c.env, post.workspaceId, c.get("userId"));
  if (role !== "owner" && role !== "admin") return c.json({ error: "forbidden" }, 403);
  if (post.status !== "pending_approval") return c.json({ error: "not_pending" }, 409);
  if (body.action === "return") {
    await db.update(posts).set({ status: "draft", updatedAt: new Date() }).where(eq(posts.id, id));
    return c.json({ ok: true, status: "draft" });
  }
  const due = post.scheduledAt && post.scheduledAt.getTime() <= Date.now();
  await db.update(posts).set({ status: due ? "queued" : "scheduled", updatedAt: new Date() }).where(eq(posts.id, id));
  if (due) await c.env.PUBLISH.send({ postId: id });
  return c.json({ ok: true, status: due ? "queued" : "scheduled" });
});

postRoutes.post("/:id/duplicate", async (c) => {
  const id = c.req.param("id");
  const body = z.object({ scheduledAt: z.number() }).parse(await c.req.json());
  const db = drizzle(c.env.DB);
  const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!post) return c.json({ error: "not_found" }, 404);
  const ws = await assertWorkspaceAccess(c.env, post.workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  const role = (await workspaceRole(c.env, post.workspaceId, c.get("userId"))) || "member";
  const copyId = crypto.randomUUID();
  const now = new Date();
  await db.insert(posts).values({
    id: copyId,
    workspaceId: post.workspaceId,
    authorId: c.get("userId"),
    body: post.body,
    status: scheduleStatus(role, "scheduled"),
    scheduledAt: new Date(body.scheduledAt),
    mediaIds: post.mediaIds,
    signatureId: post.signatureId,
    delaySeconds: 0,
    variantsJson: post.variantsJson,
    extrasJson: extrasJson(copiedExtras(post.extrasJson)),
    commentBody: post.commentBody,
    commentDelaySeconds: post.commentDelaySeconds,
    createdAt: now,
    updatedAt: now,
  });
  const dests = await db.select().from(postDestination).where(eq(postDestination.postId, id));
  for (const dest of dests) {
    await db.insert(postDestination).values({
      id: crypto.randomUUID(),
      postId: copyId,
      socialAccountId: dest.socialAccountId,
      status: "pending",
    });
  }
  return c.json({ id: copyId }, 201);
});

postRoutes.get("/public/:token", async (c) => {
  const token = c.req.param("token");
  // ponytail: json_extract scan, add a preview_token column if preview traffic matters
  const row = await c.env.DB.prepare(
    "SELECT id, body, status, scheduled_at AS scheduledAt, media_ids AS mediaIds, workspace_id AS workspaceId FROM posts WHERE json_extract(extras_json, '$.previewToken') = ? LIMIT 1",
  )
    .bind(token)
    .first<{ id: string; body: string; status: string; scheduledAt: number | null; mediaIds: string | null; workspaceId: string }>();
  if (!row) return c.json({ error: "not_found" }, 404);
  const [home] = await drizzle(c.env.DB)
    .select({ name: workspace.name, extrasJson: workspace.extrasJson })
    .from(workspace)
    .where(eq(workspace.id, row.workspaceId))
    .limit(1);
  let mediaUrls: { url: string; kind: string }[] = [];
  try {
    const ids = row.mediaIds ? (JSON.parse(row.mediaIds) as string[]).filter((id) => typeof id === "string").slice(0, 4) : [];
    const owned = ids.length
      ? await drizzle(c.env.DB)
          .select({ id: media.id, kind: media.kind })
          .from(media)
          .where(and(eq(media.workspaceId, row.workspaceId), inArray(media.id, ids)))
      : [];
    const ownedById = new Map(owned.map((item) => [item.id, item]));
    mediaUrls = await Promise.all(
      ids
        .filter((id) => ownedById.has(id))
        .map(async (mediaId) => ({ url: await signPublicMediaUrl(c.env, mediaId), kind: ownedById.get(mediaId)?.kind || "image" })),
    );
  } catch {
    mediaUrls = [];
  }
  let domain = "";
  try {
    domain = (JSON.parse(home?.extrasJson || "{}") as { customDomain?: string }).customDomain || "";
  } catch {
    domain = "";
  }
  return c.json({ body: row.body, status: row.status, scheduledAt: row.scheduledAt, studio: home?.name || "", domain, media: mediaUrls });
});

async function fillMissingAvatars(
  env: Env,
  db: ReturnType<typeof drizzle>,
  channelsByPost: Map<string, { accountId: string; avatarUrl: string | null }[]>,
) {
  const missing = new Set<string>();
  for (const channels of channelsByPost.values()) {
    for (const channel of channels) {
      if (!channel.avatarUrl) missing.add(channel.accountId);
    }
  }
  const ids = [...missing].slice(0, 8);
  if (!ids.length) return;
  const rows = await db
    .select({
      id: socialAccount.id,
      workspaceId: socialAccount.workspaceId,
      network: socialAccount.network,
      handle: socialAccount.handle,
      credentialsJson: socialAccount.credentialsJson,
    })
    .from(socialAccount)
    .where(inArray(socialAccount.id, ids));
  const found = new Map<string, string>();
  await Promise.all(
    rows.map(async (row) => {
      try {
        const creds = await decryptCredentials(env, row.credentialsJson);
        if (!creds?.accessToken) return;
        const picture = await captureProfilePicture(env, row, creds);
        if (!picture) return;
        await db.update(socialAccount).set({ avatarUrl: picture }).where(eq(socialAccount.id, row.id));
        found.set(row.id, picture);
      } catch {
        /* a missing picture still leaves the network logo */
      }
    }),
  );
  for (const channels of channelsByPost.values()) {
    for (const channel of channels) {
      const picture = found.get(channel.accountId);
      if (picture) channel.avatarUrl = picture;
    }
  }
}
