import { Hono } from "hono";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import { posts, postDestination } from "../db/schema";
import type { Env } from "../env";

const createPost = z.object({
  workspaceId: z.string(),
  body: z.string().min(1).max(5000),
  scheduledAt: z.number().optional(),
  destinations: z.array(z.string()).min(1),
  status: z.enum(["draft", "scheduled"]).default("draft"),
});

export const postRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

postRoutes.get("/", async (c) => {
  const workspaceId = c.req.query("workspaceId");
  if (!workspaceId) return c.json({ error: "workspaceId required" }, 400);
  const db = drizzle(c.env.DB);
  const rows = await db.select().from(posts).where(eq(posts.workspaceId, workspaceId));
  return c.json({ posts: rows });
});

postRoutes.post("/", async (c) => {
  const body = createPost.parse(await c.req.json());
  const id = crypto.randomUUID();
  const now = Date.now();
  const db = drizzle(c.env.DB);
  await db.insert(posts).values({
    id,
    workspaceId: body.workspaceId,
    authorId: c.get("userId"),
    body: body.body,
    status: body.status,
    scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
    createdAt: new Date(now),
    updatedAt: new Date(now),
  });
  for (const socialAccountId of body.destinations) {
    await db.insert(postDestination).values({
      id: crypto.randomUUID(),
      postId: id,
      socialAccountId,
      status: "pending",
    });
  }
  return c.json({ id }, 201);
});

postRoutes.post("/:id/queue-now", async (c) => {
  const id = c.req.param("id");
  const db = drizzle(c.env.DB);
  await db.update(posts).set({ status: "queued", updatedAt: new Date() }).where(and(eq(posts.id, id)));
  await c.env.PUBLISH.send({ postId: id });
  return c.json({ ok: true });
});
