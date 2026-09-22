import { Hono } from "hono";
import { cors } from "hono/cors";
import { createAuth } from "./auth";
import { postRoutes } from "./routes/posts";
import { SchedulerLock } from "./do/scheduler-lock";
import type { Env } from "./env";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, lte } from "drizzle-orm";
import { posts } from "./db/schema";

export { SchedulerLock };

const app = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

app.use("*", async (c, next) => {
  return cors({
    origin: c.env.WEB_ORIGIN,
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  })(c, next);
});

app.on(["POST", "GET"], "/api/auth/*", (c) => createAuth(c.env).handler(c.req.raw));

app.use("/v1/*", async (c, next) => {
  const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) return c.json({ error: "unauthorized" }, 401);
  c.set("userId", session.user.id);
  await next();
});

app.route("/v1/posts", postRoutes);
app.get("/healthz", (c) => c.json({ ok: true, service: "sundraft-api" }));

async function claimDue(env: Env) {
  const db = drizzle(env.DB);
  const due = await db.select().from(posts).where(and(eq(posts.status, "scheduled"), lte(posts.scheduledAt, new Date())));
  for (const post of due) {
    await db.update(posts).set({ status: "queued", updatedAt: new Date() }).where(eq(posts.id, post.id));
    await env.PUBLISH.send({ postId: post.id });
  }
}

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(claimDue(env));
  },
  async queue(batch: MessageBatch<{ postId: string }>, env: Env) {
    for (const msg of batch.messages) {
      const stub = env.SCHEDULER_LOCK.get(env.SCHEDULER_LOCK.idFromName(msg.body.postId));
      const lock = await stub.fetch("https://lock", {
        method: "POST",
        headers: { "x-job-id": msg.id, "content-type": "application/json" },
        body: JSON.stringify({ action: "acquire" }),
      });
      if (!lock.ok) { msg.retry(); continue; }
      env.METRICS.writeDataPoint({ blobs: ["publish"], doubles: [1], indexes: [msg.body.postId] });
      msg.ack();
    }
  },
};
