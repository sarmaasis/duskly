import { Hono } from "hono";
import { cors } from "hono/cors";
import { createAuth } from "./auth";
import { postRoutes } from "./routes/posts";
import { billingRoutes, handleDodoWebhook } from "./routes/billing";
import { mediaRoutes } from "./routes/media";
import { aiRoutes } from "./routes/ai";
import {
  workspaceRoutes,
  accountRoutes,
  teamRoutes,
  orgRoutes,
} from "./routes/workspace";
import { SchedulerLock } from "./do/scheduler-lock";
import type { Env } from "./env";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, lte } from "drizzle-orm";
import { posts, postDestination, socialAccount, rssFeed, workspace } from "./db/schema";
import { adapters, type Network } from "./lib/networks";
import { dispatchWebhooks } from "./lib/webhooks-out";
import { sha256Hex } from "./lib/workspace";
import { apiToken } from "./db/schema";

export { SchedulerLock };

const app = new Hono<{ Bindings: Env; Variables: { userId: string; email?: string } }>();

app.use("*", async (c, next) => {
  return cors({
    origin: c.env.WEB_ORIGIN,
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization", "X-Api-Token"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  })(c, next);
});

app.on(["POST", "GET"], "/api/auth/*", (c) => {
  const auth = createAuth(c.env);
  return auth.handler(c.req.raw);
});

app.post("/webhooks/dodo", (c) => handleDodoWebhook(c.req.raw, c.env));

app.use("/v1/*", async (c, next) => {
  const token = c.req.header("x-api-token") || c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
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
  const auth = createAuth(c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) return c.json({ error: "unauthorized" }, 401);
  c.set("userId", session.user.id);
  c.set("email", session.user.email);
  await next();
});

app.route("/v1/posts", postRoutes);
app.route("/v1/billing", billingRoutes);
app.route("/v1/media", mediaRoutes);
app.route("/v1/ai", aiRoutes);
app.route("/v1/workspaces", workspaceRoutes);
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
      const channelIds = JSON.parse(feed.channelIds) as string[];
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
  const dests = await db.select().from(postDestination).where(eq(postDestination.postId, postId));
  let anyPublished = false;
  let anyQueued = false;
  for (const d of dests) {
    const [acct] = await db.select().from(socialAccount).where(eq(socialAccount.id, d.socialAccountId)).limit(1);
    if (!acct) {
      await db
        .update(postDestination)
        .set({ status: "failed", error: "account missing" })
        .where(eq(postDestination.id, d.id));
      continue;
    }
    const adapter = adapters[acct.network as Network];
    const creds = acct.credentialsJson ? (JSON.parse(acct.credentialsJson) as Record<string, string>) : undefined;
    const result = await adapter.publish({
      body: post.body,
      handle: acct.handle,
      token: acct.tokenCipher,
      credentials: creds,
    });
    if ("remoteId" in result) {
      anyPublished = true;
      await db
        .update(postDestination)
        .set({ status: "published", remoteId: result.remoteId, error: null })
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
  if (anyPublished) {
    await dispatchWebhooks(env, post.workspaceId, "post.published", { postId, body: post.body });
  }
}

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(claimDue(env));
    ctx.waitUntil(pollRss(env));
  },
  async queue(batch: MessageBatch<{ postId: string }>, env: Env) {
    for (const msg of batch.messages) {
      const stub = env.SCHEDULER_LOCK.get(env.SCHEDULER_LOCK.idFromName(msg.body.postId));
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
        await publishPost(env, msg.body.postId);
        env.METRICS.writeDataPoint({ blobs: ["publish"], doubles: [1], indexes: [msg.body.postId] });
        msg.ack();
      } catch {
        msg.retry();
      }
    }
  },
};
