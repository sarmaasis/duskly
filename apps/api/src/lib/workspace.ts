import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import { workspace, workspaceMember } from "../db/schema";
import type { Env } from "../env";

export async function ensureDefaultWorkspace(env: Env, userId: string, name = "My workspace") {
  const db = drizzle(env.DB);
  const owned = await db.select().from(workspace).where(eq(workspace.ownerId, userId)).limit(1);
  if (owned[0]) return owned[0];
  const member = await db.select().from(workspaceMember).where(eq(workspaceMember.userId, userId)).limit(1);
  if (member[0]) {
    const [ws] = await db.select().from(workspace).where(eq(workspace.id, member[0].workspaceId)).limit(1);
    if (ws) return ws;
  }
  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(workspace).values({
    id,
    name,
    ownerId: userId,
    plan: "standard",
    theme: "light",
    createdAt: now,
  });
  await db.insert(workspaceMember).values({ workspaceId: id, userId, role: "owner" });
  return { id, name, ownerId: userId, plan: "standard", signature: null, theme: "light", createdAt: now };
}

export async function assertWorkspaceAccess(env: Env, workspaceId: string, userId: string) {
  const db = drizzle(env.DB);
  const [ws] = await db.select().from(workspace).where(eq(workspace.id, workspaceId)).limit(1);
  if (!ws) return null;
  if (userId.startsWith("token:")) {
    return userId === `token:${workspaceId}` ? ws : null;
  }
  if (ws.ownerId === userId) return ws;
  const [m] = await db
    .select()
    .from(workspaceMember)
    .where(and(eq(workspaceMember.workspaceId, workspaceId), eq(workspaceMember.userId, userId)))
    .limit(1);
  return m ? ws : null;
}

export async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hmacSign(secret: string, body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function monthPeriod() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
