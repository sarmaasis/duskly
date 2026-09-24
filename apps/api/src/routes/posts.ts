import { Hono } from "hono";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc, inArray } from "drizzle-orm";
import {
  media,
  posts,
  postDestination,
  socialAccount,
  signature as signatureTable,
  postingSet,
} from "../db/schema";
import type { Env } from "../env";
import { assertWorkspaceAccess } from "../lib/workspace";
import { planErrorResponse } from "../lib/entitlements";
import { expandRepeatTimes } from "../lib/schedule";
import { isImageMedia } from "../lib/networks";
import { signPublicMediaUrl } from "../lib/media-signed-url";

export const createPost = z.object({
  workspaceId: z.string(),
  body: z.string().min(1).max(5000),
  scheduledAt: z.number().optional(),
  destinations: z.array(z.string()).default([]),
  status: z.enum(["draft", "scheduled"]).default("draft"),
  mediaIds: z.array(z.string()).max(20).optional(),
  signatureId: z.string().optional().nullable(),
  delaySeconds: z.number().int().min(0).max(86400).optional(),
  repeatRule: z.enum(["none", "daily", "weekly"]).optional(),
  repeatUntil: z.number().optional().nullable(),
  postingSetId: z.string().optional().nullable(),
  commentBody: z.string().max(2000).optional().nullable(),
  commentDelaySeconds: z.number().int().min(0).max(86400).optional(),
});

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

postRoutes.get("/", async (c) => {
  const workspaceId = c.req.query("workspaceId");
  if (!workspaceId) return c.json({ error: "workspaceId required" }, 400);
  const ws = await assertWorkspaceAccess(c.env, workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  const db = drizzle(c.env.DB);
  const rows = await db
    .select()
    .from(posts)
    .where(eq(posts.workspaceId, workspaceId))
    .orderBy(desc(posts.scheduledAt));
  const ids = rows.map((row) => row.id);
  const issuesByPost = new Map<string, { network: string; handle: string; status: string; error: string | null }[]>();
  const channelsByPost = new Map<string, { network: string; handle: string; status: string }[]>();
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
        network: socialAccount.network,
        handle: socialAccount.handle,
      })
      .from(postDestination)
      .innerJoin(socialAccount, eq(postDestination.socialAccountId, socialAccount.id))
      .where(inArray(postDestination.postId, ids));
    for (const dest of dests) {
      const channels = channelsByPost.get(dest.postId) ?? [];
      channels.push({ network: dest.network, handle: dest.handle, status: dest.status });
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
  }
  const mediaRows = mediaIdSet.size
    ? await db.select().from(media).where(inArray(media.id, [...mediaIdSet]))
    : [];
  const mediaById = new Map(mediaRows.map((row) => [row.id, row]));
  const postsOut = [];
  for (const row of rows) {
    const attached = (mediaIdsByPost.get(row.id) ?? [])
      .map((id) => mediaById.get(id))
      .filter((item): item is (typeof mediaRows)[number] => !!item);
    const previewSource = attached.find((item) => item.kind !== "video") ?? attached[0];
    const preview = previewSource
      ? {
          id: previewSource.id,
          kind: previewSource.kind,
          url: await signPublicMediaUrl(c.env, previewSource.id),
        }
      : null;
    postsOut.push({
      ...row,
      issues: issuesByPost.get(row.id) ?? [],
      channels: channelsByPost.get(row.id) ?? [],
      preview,
    });
  }
  return c.json({ posts: postsOut });
});

postRoutes.post("/", async (c) => {
  try {
    const body = createPost.parse(await c.req.json());
    const ws = await assertWorkspaceAccess(c.env, body.workspaceId, c.get("userId"));
    if (!ws) return c.json({ error: "forbidden" }, 403);
    const db = drizzle(c.env.DB);

    let destinations = body.destinations;
    let postBody = body.body;
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
    const invalid = await validateWorkspaceRefs(c.env, body.workspaceId, destinations, body.mediaIds);
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

    const id = crypto.randomUUID();
    const now = Date.now();
    const delay = body.delaySeconds ?? 0;
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
      status: body.status,
      scheduledAt,
      mediaIds: body.mediaIds?.length ? JSON.stringify(body.mediaIds) : null,
      signatureId: appliedSignatureId,
      delaySeconds: delay,
      repeatRule: body.repeatRule && body.repeatRule !== "none" ? body.repeatRule : null,
      repeatUntil: body.repeatUntil ? new Date(body.repeatUntil) : null,
      postingSetId: body.postingSetId ?? null,
      commentBody: body.commentBody ?? null,
      commentDelaySeconds: body.commentDelaySeconds ?? 0,
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
      for (const next of expandRepeatTimes(scheduledAt.getTime(), body.repeatRule, body.repeatUntil)) {
        const rid = crypto.randomUUID();
        await db.insert(posts).values({
          id: rid,
          workspaceId: body.workspaceId,
          authorId: c.get("userId"),
          body: postBody,
          status: "scheduled",
          scheduledAt: new Date(next),
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
  await db.update(posts).set({ status: "queued", updatedAt: new Date() }).where(eq(posts.id, id));
  await c.env.PUBLISH.send({ postId: id });
  return c.json({ ok: true });
});
