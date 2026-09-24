import { Hono } from "hono";
import { cors } from "hono/cors";
import { getAuth } from "./auth";
import { postRoutes } from "./routes/posts";
import { inboxRoutes } from "./routes/inbox";
import { billingRoutes, handleDodoWebhook } from "./routes/billing";
import { mediaRoutes } from "./routes/media";
import { aiRoutes } from "./routes/ai";
import {
  workspaceRoutes,
  accountRoutes,
  teamRoutes,
  orgRoutes,
} from "./routes/workspace";
import { oauthRoutes } from "./routes/oauth";
import { instagramWebhookRoutes } from "./routes/instagram-webhook";
import { metaDeletionRoutes } from "./routes/meta-deletion";
import { mcpRoutes } from "./routes/mcp";
import { refreshAccessToken } from "./lib/oauth-tokens";
import { SchedulerLock } from "./do/scheduler-lock";
import type { Env } from "./env";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, inArray, lte } from "drizzle-orm";
import { posts, postDestination, socialAccount, rssFeed, workspace, media, apiToken } from "./db/schema";
import { adapters, firstPublishMedia, isImageMedia, isVideoMedia, type Network } from "./lib/networks";
import { signPublicMediaUrl } from "./lib/media-signed-url";
import { dispatchWebhooks } from "./lib/webhooks-out";
import { sha256Hex } from "./lib/workspace";
import { runOnPublishPlugs, runSchedulePlugs } from "./lib/plugs";
import { decryptCredentials, decryptSecret, encryptCredentials, encryptSecret } from "./lib/secrets";
import { parseEmailSender, sendViaEmailBinding } from "./lib/email-sender";
import { commentQueueDelay, mergeRssChannelIds, shouldDeferFirstComment } from "./lib/schedule";

export { SchedulerLock };

const app = new Hono<{ Bindings: Env; Variables: { userId: string; email?: string } }>();

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
// ponytail: 5s session cache per isolate. Drop if a revoked cookie must die immediately.
const sessionCache = new Map<string, { exp: number; session: { user: { id: string; email: string } } }>();

function securityHeaders(res: Response) {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return res;
}

app.use("*", async (c, next) => {
  return cors({
    origin: c.env.WEB_ORIGIN,
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization", "X-Api-Token"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  })(c, next);
});

app.use("*", async (c, next) => {
  await next();
  securityHeaders(c.res);
});

app.on(["POST", "GET"], "/api/auth/*", (c) => {
  const auth = getAuth(c.env, c.req.raw.cf as IncomingRequestCfProperties | undefined);
  return auth.handler(c.req.raw);
});

app.post("/webhooks/dodo", (c) => handleDodoWebhook(c.req.raw, c.env));

app.route("/mcp", mcpRoutes);

app.use("/v1/*", async (c, next) => {
  // OAuth provider callback must not require session cookies (browser returns from X/LI/Mastodon).
  if (c.req.path.match(/^\/v1\/accounts\/oauth\/[^/]+\/callback$/)) {
    await next();
    return;
  }
  // Meta signed data-deletion callback is public (reviewers and Facebook hit it unauthenticated).
  if (c.req.path === "/v1/meta/data-deletion" || c.req.path === "/v1/meta-deletion") {
    await next();
    return;
  }
  // Instagram webhook challenge + event delivery (not the OAuth callback).
  if (c.req.path === "/v1/instagram/webhook") {
    await next();
    return;
  }
  // Signed, time-limited media URLs for providers (Instagram) that fetch the file themselves.
  if (c.req.path.match(/^\/v1\/media\/[^/]+\/public$/)) {
    await next();
    return;
  }
  if (c.req.method === "GET" && c.req.path.match(/^\/v1\/posts\/public\/[^/]+$/)) {
    await next();
    return;
  }
  if (c.req.method === "GET" && c.req.path.match(/^\/v1\/team\/invite\/[^/]+$/)) {
    await next();
    return;
  }
  const token = c.req.header("x-api-token") || c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token && MUTATING.has(c.req.method)) {
    const origin = c.req.header("origin");
    if (origin !== c.env.WEB_ORIGIN) return c.json({ error: "bad_origin" }, 403);
  }
  if (token?.startsWith("dk_")) {
    const hash = await sha256Hex(token);
    const db = drizzle(c.env.DB);
    const [row] = await db.select().from(apiToken).where(eq(apiToken.tokenHash, hash)).limit(1);
    if (!row) return c.json({ error: "unauthorized" }, 401);
    await db.update(apiToken).set({ lastUsedAt: new Date() }).where(eq(apiToken.id, row.id));
    c.set("userId", `token:${row.workspaceId}`);
    await next();
    return;
  }
  const auth = getAuth(c.env, c.req.raw.cf as IncomingRequestCfProperties | undefined);
  type AuthSession = { user: { id: string; email: string } };
  let session: AuthSession | null = null;
  const cookie = c.req.header("cookie") || "";
  const cached = cookie ? sessionCache.get(cookie) : undefined;
  if (cached && cached.exp > Date.now()) {
    session = cached.session;
  } else {
    try {
      session = (await auth.api.getSession({ headers: c.req.raw.headers })) as AuthSession | null;
    } catch {
      return c.json({ error: "unauthorized" }, 401);
    }
    if (session?.user && cookie) {
      if (sessionCache.size > 200) sessionCache.clear();
      sessionCache.set(cookie, { exp: Date.now() + 5000, session });
    }
  }
  if (!session?.user) return c.json({ error: "unauthorized" }, 401);
  c.set("userId", session.user.id);
  c.set("email", session.user.email);
  await next();
});

app.route("/v1/posts", postRoutes);
app.route("/v1/inbox", inboxRoutes);
app.route("/v1/billing", billingRoutes);
app.route("/v1/media", mediaRoutes);
app.route("/v1/ai", aiRoutes);
app.route("/v1/workspaces", workspaceRoutes);
app.route("/v1/accounts/oauth", oauthRoutes);
app.route("/v1/instagram/webhook", instagramWebhookRoutes);
app.route("/v1/meta/data-deletion", metaDeletionRoutes);
app.route("/v1/meta-deletion", metaDeletionRoutes);
app.route("/v1/accounts", accountRoutes);
app.route("/v1/team", teamRoutes);
app.route("/v1/org", orgRoutes);
app.get("/healthz", (c) => c.json({ ok: true, service: "duskly-api" }));

async function claimDue(env: Env) {
  const db = drizzle(env.DB);
  const due = await db
    .select()
    .from(posts)
    .where(and(eq(posts.status, "scheduled"), lte(posts.scheduledAt, new Date())));
  for (const post of due) {
    await db.update(posts).set({ status: "queued", updatedAt: new Date() }).where(eq(posts.id, post.id));
    await env.PUBLISH.send({ postId: post.id });
  }
}

async function pollRss(env: Env) {
  const db = drizzle(env.DB);
  const feeds = await db.select().from(rssFeed).where(eq(rssFeed.active, true));
  for (const feed of feeds) {
    try {
      const res = await fetch(feed.url);
      if (!res.ok) continue;
      const xml = await res.text();
      const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 5);
      let channelIds = JSON.parse(feed.channelIds || "[]") as string[];
      if (feed.groupId) {
        const members = await db
          .select({ id: socialAccount.id })
          .from(socialAccount)
          .where(and(eq(socialAccount.workspaceId, feed.workspaceId), eq(socialAccount.groupId, feed.groupId)));
        channelIds = mergeRssChannelIds(channelIds, members.map((m) => m.id));
      }
      if (!channelIds.length) continue;
      let newestGuid = feed.lastGuid;
      for (const m of items.reverse()) {
        const block = m[1];
        const guid = (block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1] ||
          block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ||
          "")
          .replace(/<!\[CDATA\[|\]\]>/g, "")
          .trim();
        const title = (block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "")
          .replace(/<!\[CDATA\[|\]\]>/g, "")
          .trim();
        if (!guid || guid === feed.lastGuid) continue;
        if (newestGuid === feed.lastGuid) newestGuid = guid;
        const postId = crypto.randomUUID();
        const [ws] = await db.select().from(workspace).where(eq(workspace.id, feed.workspaceId)).limit(1);
        await db.insert(posts).values({
          id: postId,
          workspaceId: feed.workspaceId,
          authorId: ws?.ownerId ?? feed.workspaceId,
          body: title || guid,
          status: "scheduled",
          scheduledAt: new Date(Date.now() + 60_000),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        for (const socialAccountId of channelIds) {
          await db.insert(postDestination).values({
            id: crypto.randomUUID(),
            postId,
            socialAccountId,
            status: "pending",
          });
        }
        newestGuid = guid;
      }
      if (newestGuid && newestGuid !== feed.lastGuid) {
        await db.update(rssFeed).set({ lastGuid: newestGuid }).where(eq(rssFeed.id, feed.id));
      }
    } catch {
      /* skip bad feeds */
    }
  }
}

async function publishPost(env: Env, postId: string) {
  const db = drizzle(env.DB);
  const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!post) return;
  await db.update(posts).set({ status: "publishing", updatedAt: new Date() }).where(eq(posts.id, postId));

  const rows = await db
    .select({
      id: postDestination.id,
      socialAccountId: postDestination.socialAccountId,
      status: postDestination.status,
      remoteId: postDestination.remoteId,
      network: socialAccount.network,
      handle: socialAccount.handle,
      tokenCipher: socialAccount.tokenCipher,
      credentialsJson: socialAccount.credentialsJson,
    })
    .from(postDestination)
    .innerJoin(socialAccount, eq(postDestination.socialAccountId, socialAccount.id))
    .where(eq(postDestination.postId, postId));

  const delay = post.commentDelaySeconds ?? 0;
  const deferComment = shouldDeferFirstComment(delay, post.commentBody);
  let anyPublished = false;
  let anyQueued = false;
  const commentNotes: string[] = [];

  let videoBytes: ArrayBuffer | undefined;
  let videoContentType: string | undefined;
  let imageUrl: string | undefined;
  let imageBytes: ArrayBuffer | undefined;
  let imageContentType: string | undefined;
  let firstImageId = "";
  let videoUrl = "";
  let coverUrl = "";
  let mediaIds: string[] = [];
  try {
    mediaIds = post.mediaIds ? (JSON.parse(post.mediaIds) as string[]) : [];
    if (mediaIds.length) {
      const mediaRows = await db.select().from(media).where(inArray(media.id, mediaIds));
      const first = firstPublishMedia(mediaIds, mediaRows);
      const firstImage = firstPublishMedia(mediaIds, mediaRows.filter(isImageMedia));
      if (first && isVideoMedia(first)) {
        videoUrl = await signPublicMediaUrl(env, first.id);
        const obj = await env.MEDIA.get(first.r2Key);
        if (obj) {
          videoBytes = await obj.arrayBuffer();
          videoContentType = first.contentType;
        }
      }
      if (firstImage) {
        firstImageId = firstImage.id;
        imageUrl = await signPublicMediaUrl(env, firstImage.id);
        const obj = await env.MEDIA.get(firstImage.r2Key);
        if (obj) {
          imageBytes = await obj.arrayBuffer();
          imageContentType = firstImage.contentType;
        }
      }
    }
  } catch {
    /* lookup failure is treated as missing media below */
  }
  const mediaMissing = mediaIds.length > 0 && !imageUrl && !imageBytes && !videoBytes;

  let extras: {
    poll?: { question: string; options: string[] };
    thread?: string[];
    postType?: string;
    coverId?: string;
    alts?: Record<string, string>;
  } = {};
  try {
    extras = post.extrasJson ? JSON.parse(post.extrasJson) : {};
  } catch {
    extras = {};
  }
  if (extras.coverId) {
    try {
      coverUrl = await signPublicMediaUrl(env, extras.coverId);
    } catch {
      coverUrl = "";
    }
  }

  for (const d of rows) {
    if (d.status === "published" && d.remoteId) {
      anyPublished = true;
      continue;
    }
    const adapter = adapters[d.network as Network];
    if (!adapter) {
      await db.update(postDestination).set({ status: "failed", error: "unknown network" }).where(eq(postDestination.id, d.id));
      continue;
    }
    let creds = (await decryptCredentials(env, d.credentialsJson)) || {};
    let token = await decryptSecret(env, d.tokenCipher);
    let handle = d.handle;
    const refreshed = await refreshAccessToken(env, d.network as Network, creds);
    if (!refreshed.ok) {
      await alertWorkspace(env, post.workspaceId, "token.dead", `${d.network} @${handle}: ${refreshed.reason}`);
    }
    if (refreshed.ok && !("skipped" in refreshed && refreshed.skipped)) {
      creds = refreshed.creds;
      token = refreshed.accessToken;
      await db
        .update(socialAccount)
        .set({
          tokenCipher: await encryptSecret(env, token),
          credentialsJson: await encryptCredentials(env, creds),
        })
        .where(eq(socialAccount.id, d.socialAccountId));
    }
    if (mediaMissing) {
      anyQueued = true;
      await db
        .update(postDestination)
        .set({ status: "queued", error: "attached media could not be loaded for publish" })
        .where(eq(postDestination.id, d.id));
      continue;
    }
    if (imageUrl && !creds.imageUrl) creds = { ...creds, imageUrl };
    if (extras.poll) creds = { ...creds, pollJson: JSON.stringify(extras.poll) };
    if (extras.thread?.length) creds = { ...creds, threadJson: JSON.stringify(extras.thread) };
    if (extras.postType) creds = { ...creds, postType: extras.postType };
    const alt = extras.alts?.[firstImageId];
    if (alt) creds = { ...creds, altText: alt };
    if (coverUrl) creds = { ...creds, coverUrl };
    if (videoUrl) creds = { ...creds, videoUrl };
    let variants: Record<string, string> = {};
    try {
      const parsed = post.variantsJson ? JSON.parse(post.variantsJson) : {};
      if (parsed && typeof parsed === "object") variants = parsed;
    } catch {
      variants = {};
    }
    const result = await adapter.publish({
      body: variants[d.socialAccountId]?.trim() || post.body,
      handle,
      token,
      credentials: creds,
      commentBody: post.commentBody,
      skipComment: deferComment,
      videoBytes,
      videoContentType,
      imageBytes,
      imageContentType,
    });
    if ("remoteId" in result) {
      anyPublished = true;
      const noteParts = [
        result.commentRemoteId ? `comment:${result.commentRemoteId}` : null,
        result.commentSkipped ? `comment_skip:${result.commentSkipped}` : null,
        deferComment ? "comment:deferred" : null,
      ].filter(Boolean);
      if (result.commentSkipped) commentNotes.push(`${d.network}: ${result.commentSkipped}`);
      await db
        .update(postDestination)
        .set({
          status: "published",
          remoteId: result.remoteId,
          error: noteParts.length ? noteParts.join("; ") : null,
        })
        .where(eq(postDestination.id, d.id));
    } else {
      anyQueued = true;
      await db
        .update(postDestination)
        .set({ status: "queued", error: result.reason })
        .where(eq(postDestination.id, d.id));
    }
  }

  const status = anyPublished && !anyQueued ? "published" : anyQueued ? "queued" : "failed";
  await db
    .update(posts)
    .set({
      status,
      publishedAt: anyPublished ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, postId));

  if (anyPublished && deferComment) {
    await env.PUBLISH.send(
      { postId, action: "comment" },
      { delaySeconds: commentQueueDelay(delay) },
    );
  }

  if (anyQueued) {
    await alertWorkspace(env, post.workspaceId, "post.failed", `Post ${postId} did not fully publish.`);
  }

  if (anyPublished) {
    await dispatchWebhooks(env, post.workspaceId, "post.published", {
      postId,
      body: post.body,
      commentNotes,
    });
    await runOnPublishPlugs(env, post.workspaceId, post.authorId);
  }
}

async function publishComments(env: Env, postId: string) {
  const db = drizzle(env.DB);
  const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!post?.commentBody?.trim()) return;

  const rows = await db
    .select({
      id: postDestination.id,
      remoteId: postDestination.remoteId,
      error: postDestination.error,
      network: socialAccount.network,
      handle: socialAccount.handle,
      tokenCipher: socialAccount.tokenCipher,
      credentialsJson: socialAccount.credentialsJson,
    })
    .from(postDestination)
    .innerJoin(socialAccount, eq(postDestination.socialAccountId, socialAccount.id))
    .where(eq(postDestination.postId, postId));

  for (const d of rows) {
    if (!d.remoteId) continue;
    if (d.error?.includes("comment:") && !d.error.includes("comment:deferred") && !d.error.includes("comment_skip:")) {
      continue;
    }
    const adapter = adapters[d.network as Network];
    if (!adapter?.comment) continue;
    const creds = await decryptCredentials(env, d.credentialsJson);
    const result = await adapter.comment({
      remoteId: d.remoteId,
      commentBody: post.commentBody,
      handle: d.handle,
      token: await decryptSecret(env, d.tokenCipher),
      credentials: creds,
    });
    const prev = (d.error || "").replace(/comment:deferred;?\s*/g, "").trim();
    const noteParts = [
      prev || null,
      result.commentRemoteId ? `comment:${result.commentRemoteId}` : null,
      result.commentSkipped ? `comment_skip:${result.commentSkipped}` : null,
    ].filter(Boolean);
    await db
      .update(postDestination)
      .set({ error: noteParts.length ? noteParts.join("; ") : null })
      .where(eq(postDestination.id, d.id));
  }
}

async function alertWorkspace(env: Env, workspaceId: string, event: string, text: string) {
  await dispatchWebhooks(env, workspaceId, event, { message: text });
  const db = drizzle(env.DB);
  const [ws] = await db.select({ extrasJson: workspace.extrasJson }).from(workspace).where(eq(workspace.id, workspaceId)).limit(1);
  let to = "";
  try {
    to = ((JSON.parse(ws?.extrasJson || "{}") as { alertEmail?: string }).alertEmail || "").trim();
  } catch {
    to = "";
  }
  if (!to || !env.EMAIL) return;
  try {
    await sendViaEmailBinding(env.EMAIL, {
      to,
      from: parseEmailSender(env.EMAIL_FROM),
      subject: `Duskly ${event}`,
      text,
    });
  } catch {
    /* email is best-effort */
  }
}

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(claimDue(env));
    ctx.waitUntil(pollRss(env));
    ctx.waitUntil(runSchedulePlugs(env));
  },
  async queue(batch: MessageBatch<{ postId: string; action?: string }>, env: Env) {
    for (const msg of batch.messages) {
      const lockName = msg.body.action === "comment" ? `${msg.body.postId}:comment` : msg.body.postId;
      const stub = env.SCHEDULER_LOCK.get(env.SCHEDULER_LOCK.idFromName(lockName));
      const lock = await stub.fetch("https://lock", {
        method: "POST",
        headers: { "x-job-id": msg.id, "content-type": "application/json" },
        body: JSON.stringify({ action: "acquire" }),
      });
      if (!lock.ok) {
        msg.retry();
        continue;
      }
      try {
        if (msg.body.action === "comment") await publishComments(env, msg.body.postId);
        else await publishPost(env, msg.body.postId);
        env.METRICS.writeDataPoint({ blobs: [msg.body.action || "publish"], doubles: [1], indexes: [msg.body.postId] });
        msg.ack();
      } catch {
        msg.retry();
      }
    }
  },
};
