import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import { customerGroup, socialAccount, user, workspace, workspaceInvite, workspaceMember } from "../db/schema";
import type { Env } from "../env";
import { cacheGet, cacheSet } from "./read-cache";

const ACCESS_TTL = 15_000;

type AccessHit = {
  ws: typeof workspace.$inferSelect | null;
  memberRole: string | null;
  groupId: string | null;
};

async function loadAccess(env: Env, workspaceId: string, userId: string): Promise<AccessHit> {
  const key = `access:${workspaceId}:${userId}`;
  const hit = cacheGet<AccessHit>(key);
  if (hit) return hit;
  const db = drizzle(env.DB);
  const [ws] = await db.select().from(workspace).where(eq(workspace.id, workspaceId)).limit(1);
  let value: AccessHit = { ws: null, memberRole: null, groupId: null };
  if (ws && (userId === `token:${workspaceId}` || ws.ownerId === userId)) {
    value = { ws, memberRole: "owner", groupId: null };
  } else if (ws && !userId.startsWith("token:")) {
    const [m] = await db
      .select({ role: workspaceMember.role, groupId: workspaceMember.groupId })
      .from(workspaceMember)
      .where(and(eq(workspaceMember.workspaceId, workspaceId), eq(workspaceMember.userId, userId)))
      .limit(1);
    value = m ? { ws, memberRole: m.role, groupId: m.groupId } : value;
  }
  cacheSet(key, value, ACCESS_TTL);
  return value;
}

async function acceptPendingInvites(
  db: ReturnType<typeof drizzle>,
  userId: string,
  pending: { id: string; workspaceId: string; role: string }[],
  memberships: { workspaceId: string; role: string }[],
) {
  for (const inv of pending) {
    const already = memberships.find((m) => m.workspaceId === inv.workspaceId);
    const role = inv.role === "admin" ? "admin" : "member";
    if (!already) {
      await db.insert(workspaceMember).values({ workspaceId: inv.workspaceId, userId, role });
      memberships.push({ workspaceId: inv.workspaceId, role });
    } else if (already.role === "owner") {
      const [home] = await db.select({ ownerId: workspace.ownerId }).from(workspace).where(eq(workspace.id, inv.workspaceId)).limit(1);
      if (home && home.ownerId !== userId) {
        await db
          .update(workspaceMember)
          .set({ role })
          .where(and(eq(workspaceMember.workspaceId, inv.workspaceId), eq(workspaceMember.userId, userId)));
        already.role = role;
      }
    }
    await db.update(workspaceInvite).set({ status: "accepted" }).where(eq(workspaceInvite.id, inv.id));
  }
}

export async function ensureDefaultWorkspace(env: Env, userId: string, name = "", email = "") {
  const key = `home:${userId}`;
  const cached = cacheGet<Awaited<ReturnType<typeof loadHomeWorkspace>>>(key);
  if (cached) return cached;
  const home = await loadHomeWorkspace(env, userId, name, email);
  cacheSet(key, home, ACCESS_TTL);
  return home;
}

async function loadHomeWorkspace(env: Env, userId: string, name = "", email = "") {
  const db = drizzle(env.DB);
  let knownEmail = email.toLowerCase();
  if (!knownEmail) {
    const [row] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId)).limit(1);
    knownEmail = row?.email?.toLowerCase() || "";
  }
  const [pending, memberships, owned] = await db.batch([
    db
      .select()
      .from(workspaceInvite)
      .where(and(eq(workspaceInvite.email, knownEmail || "\0"), eq(workspaceInvite.status, "pending"))),
    db.select().from(workspaceMember).where(eq(workspaceMember.userId, userId)),
    db.select().from(workspace).where(eq(workspace.ownerId, userId)).limit(1),
  ]);
  if (pending.length) await acceptPendingInvites(db, userId, pending, memberships);
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
      if (ws) return { ...ws, role: invited.role === "admin" ? ("admin" as const) : ("member" as const) };
    }
  }
  if (owned[0]) return { ...owned[0], role: "owner" as const };
  const member = memberships[0];
  if (member) {
    const [ws] = await db.select().from(workspace).where(eq(workspace.id, member.workspaceId)).limit(1);
    if (ws) return { ...ws, role: member.role === "admin" ? ("admin" as const) : member.role === "owner" ? ("owner" as const) : ("member" as const) };
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
    role: "owner" as const,
  };
}

export async function assertWorkspaceAccess(env: Env, workspaceId: string, userId: string) {
  return (await loadAccess(env, workspaceId, userId)).ws;
}

/** Owners, admins, and API tokens may read every company. A member with a company set may read only that company. */
export async function memberCompanyLimit(env: Env, workspaceId: string, userId: string) {
  if (userId.startsWith("token:")) return null;
  const access = await loadAccess(env, workspaceId, userId);
  if (!access.ws || !access.memberRole || access.memberRole === "admin" || access.memberRole === "owner") return null;
  return access.groupId || null;
}

/** Null means the whole workspace. A string is the only company this read may include. */
export async function readCompanyFilter(
  env: Env,
  workspaceId: string,
  userId: string,
  requested: string | null | undefined,
): Promise<{ groupId: string | null } | { error: "company_not_found" | "forbidden" }> {
  const asked = (requested || "").trim();
  const limit = await memberCompanyLimit(env, workspaceId, userId);
  if (limit) {
    if (asked && asked !== limit) return { error: "forbidden" };
    return { groupId: limit };
  }
  if (!asked) return { groupId: null };
  const db = drizzle(env.DB);
  const [row] = await db
    .select({ id: customerGroup.id })
    .from(customerGroup)
    .where(and(eq(customerGroup.id, asked), eq(customerGroup.workspaceId, workspaceId)))
    .limit(1);
  if (!row) return { error: "company_not_found" };
  return { groupId: row.id };
}

export async function workspaceRole(env: Env, workspaceId: string, userId: string) {
  const access = await loadAccess(env, workspaceId, userId);
  if (!access.ws || !access.memberRole) return null;
  if (access.memberRole === "admin" || access.memberRole === "owner") return access.memberRole;
  return "member" as const;
}

export async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const hmacKeys = new Map<string, CryptoKey>();

export async function hmacSign(secret: string, body: string) {
  let key = hmacKeys.get(secret);
  if (!key) {
    key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    hmacKeys.set(secret, key);
  }
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function monthPeriod() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
