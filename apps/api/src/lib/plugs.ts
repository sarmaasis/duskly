import { drizzle } from "drizzle-orm/d1";
import { eq, and, or, isNull } from "drizzle-orm";
import { plug, posts, postDestination, socialAccount, workspace } from "../db/schema";
import type { Env } from "../env";

type PlugAction = {
  type: string;
  body: string;
  channelId?: string;
  everyMinutes?: number;
};

async function createPlugPost(
  env: Env,
  workspaceId: string,
  authorId: string,
  action: PlugAction,
  delayMs = 60_000,
) {
  const db = drizzle(env.DB);
  let channelId = action.channelId;
  if (!channelId) {
    const [ch] = await db.select().from(socialAccount).where(eq(socialAccount.workspaceId, workspaceId)).limit(1);
    channelId = ch?.id;
  }
  if (!channelId) return null;
  const [validChannel] = await db
    .select({ id: socialAccount.id })
    .from(socialAccount)
    .where(and(eq(socialAccount.id, channelId), eq(socialAccount.workspaceId, workspaceId)))
    .limit(1);
  if (!validChannel) return null;
  const postId = crypto.randomUUID();
  await db.insert(posts).values({
    id: postId,
    workspaceId,
    authorId,
    body: action.body,
    status: "scheduled",
    scheduledAt: new Date(Date.now() + delayMs),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(postDestination).values({
    id: crypto.randomUUID(),
    postId,
    socialAccountId: channelId,
    status: "pending",
  });
  return postId;
}

/** Fire on_publish plugs after a successful outbound publish. */
export async function runOnPublishPlugs(env: Env, workspaceId: string, authorId: string) {
  const db = drizzle(env.DB);
  const rows = await db
    .select()
    .from(plug)
    .where(and(eq(plug.active, true), eq(plug.triggerType, "on_publish")));
  for (const p of rows) {
    const forWs =
      (p.scope === "internal" && p.workspaceId === workspaceId) ||
      (p.scope === "global" && (p.workspaceId == null || p.workspaceId === workspaceId));
    if (!forWs) continue;
    const action = JSON.parse(p.actionJson) as PlugAction;
    if (action.type !== "create_post") continue;
    await createPlugPost(env, workspaceId, authorId, action, 5 * 60_000);
  }
}

/** Fire schedule plugs on the cron tick (rate-limited via KV). */
export async function runSchedulePlugs(env: Env) {
  const db = drizzle(env.DB);
  const rows = await db
    .select()
    .from(plug)
    .where(and(eq(plug.active, true), eq(plug.triggerType, "schedule")));
  for (const p of rows) {
    const action = JSON.parse(p.actionJson) as PlugAction;
    if (action.type !== "create_post") continue;
    const workspaceId = p.workspaceId;
    if (!workspaceId) continue;
    const every = Math.max(15, action.everyMinutes ?? 60);
    const key = `plug:sched:${p.id}`;
    const last = await env.KV.get(key);
    if (last && Date.now() - Number(last) < every * 60_000) continue;
    const [ws] = await db.select().from(workspace).where(eq(workspace.id, workspaceId)).limit(1);
    if (!ws) continue;
    await createPlugPost(env, workspaceId, ws.ownerId, action, 60_000);
    await env.KV.put(key, String(Date.now()), { expirationTtl: 60 * 60 * 24 * 7 });
  }
}

export { createPlugPost };
