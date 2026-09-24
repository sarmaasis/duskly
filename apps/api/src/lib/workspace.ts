import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import { socialAccount, user, workspace, workspaceInvite, workspaceMember } from "../db/schema";
import type { Env } from "../env";

async function acceptPendingInvites(db: ReturnType<typeof drizzle>, userId: string) {
  const [row] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId)).limit(1);
  const email = row?.email?.toLowerCase();
  if (!email) return;
  const pending = await db
    .select()
    .from(workspaceInvite)
    .where(and(eq(workspaceInvite.email, email), eq(workspaceInvite.status, "pending")));
  for (const inv of pending) {
    const [already] = await db
      .select()
      .from(workspaceMember)
      .where(and(eq(workspaceMember.workspaceId, inv.workspaceId), eq(workspaceMember.userId, userId)))
      .limit(1);
    const role = inv.role === "admin" ? "admin" : "member";
    if (!already) {
      await db.insert(workspaceMember).values({ workspaceId: inv.workspaceId, userId, role });
    } else if (already.role === "owner") {
      const [home] = await db.select({ ownerId: workspace.ownerId }).from(workspace).where(eq(workspace.id, inv.workspaceId)).limit(1);
      if (home && home.ownerId !== userId) {
        await db
          .update(workspaceMember)
          .set({ role })
          .where(and(eq(workspaceMember.workspaceId, inv.workspaceId), eq(workspaceMember.userId, userId)));
      }
    }
    await db.update(workspaceInvite).set({ status: "accepted" }).where(eq(workspaceInvite.id, inv.id));
  }
}

export async function ensureDefaultWorkspace(env: Env, userId: string, name = "") {
  const db = drizzle(env.DB);
  await acceptPendingInvites(db, userId);
  const memberships = await db.select().from(workspaceMember).where(eq(workspaceMember.userId, userId));
  const invited = memberships.find((m) => m.role === "member" || m.role === "admin");
  if (invited) {
    const ownedMembership = memberships.find((m) => m.role === "owner");
    const [channel] = ownedMembership
      ? await db
          .select({ id: socialAccount.id })
          .from(socialAccount)
          .where(eq(socialAccount.workspaceId, ownedMembership.workspaceId))
          .limit(1)
      : [];
    if (!ownedMembership || !channel) {
      const [ws] = await db.select().from(workspace).where(eq(workspace.id, invited.workspaceId)).limit(1);
      if (ws) return ws;
    }
  }
  const owned = await db.select().from(workspace).where(eq(workspace.ownerId, userId)).limit(1);
  if (owned[0]) return owned[0];
  const member = memberships[0];
  if (member) {
    const [ws] = await db.select().from(workspace).where(eq(workspace.id, member.workspaceId)).limit(1);
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
    accountKind: null,
    onboardingCompleted: false,
    extrasJson: null,
    createdAt: now,
  });
  await db.insert(workspaceMember).values({ workspaceId: id, userId, role: "owner" });
  return {
    id,
    name,
    ownerId: userId,
    plan: "standard",
    signature: null,
    theme: "light",
    accountKind: null,
    onboardingCompleted: false,
    extrasJson: null,
    createdAt: now,
  };
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

export async function workspaceRole(env: Env, workspaceId: string, userId: string) {
  const db = drizzle(env.DB);
  const [ws] = await db.select({ ownerId: workspace.ownerId }).from(workspace).where(eq(workspace.id, workspaceId)).limit(1);
  if (!ws) return null;
  if (ws.ownerId === userId || userId === `token:${workspaceId}`) return "owner" as const;
  const [m] = await db
    .select({ role: workspaceMember.role })
    .from(workspaceMember)
    .where(and(eq(workspaceMember.workspaceId, workspaceId), eq(workspaceMember.userId, userId)))
    .limit(1);
  if (!m) return null;
  if (m.role === "admin" || m.role === "owner") return m.role as "admin" | "owner";
  return "member" as const;
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
