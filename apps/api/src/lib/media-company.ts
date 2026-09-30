import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { customerGroup, media, postDestination, posts, socialAccount } from "../db/schema";

type DB = ReturnType<typeof drizzle>;

/** Empty when the file belongs to the whole workspace. Rejects a company id from another workspace. */
export async function resolveMediaGroup(
  db: DB,
  workspaceId: string,
  groupId?: string | null,
): Promise<{ groupId: string | null } | { error: "company_not_found" }> {
  const id = (groupId || "").trim();
  if (!id) return { groupId: null };
  const [row] = await db
    .select({ id: customerGroup.id })
    .from(customerGroup)
    .where(and(eq(customerGroup.id, id), eq(customerGroup.workspaceId, workspaceId)))
    .limit(1);
  if (!row) return { error: "company_not_found" };
  return { groupId: row.id };
}

/** Files uploaded before companies were stored stay untagged. If a post uses one for a single company, keep it there. */
export async function claimMediaCompanies(db: DB, workspaceId: string) {
  const loose = await db
    .select({ id: media.id })
    .from(media)
    .where(and(eq(media.workspaceId, workspaceId), isNull(media.groupId)));
  if (!loose.length) return;
  const looseIds = new Set(loose.map((row) => row.id));
  const used = await db
    .select({ mediaIds: posts.mediaIds, groupId: socialAccount.groupId })
    .from(posts)
    .innerJoin(postDestination, eq(postDestination.postId, posts.id))
    .innerJoin(socialAccount, eq(socialAccount.id, postDestination.socialAccountId))
    .where(eq(posts.workspaceId, workspaceId));
  const owners = new Map<string, Set<string>>();
  for (const row of used) {
    if (!row.mediaIds || !row.groupId) continue;
    let ids: unknown;
    try {
      ids = JSON.parse(row.mediaIds);
    } catch {
      continue;
    }
    if (!Array.isArray(ids)) continue;
    for (const id of ids) {
      if (typeof id !== "string" || !looseIds.has(id)) continue;
      const set = owners.get(id) || new Set<string>();
      set.add(row.groupId);
      owners.set(id, set);
    }
  }
  for (const [id, set] of owners) {
    if (set.size !== 1) continue;
    const groupId = [...set][0];
    await db
      .update(media)
      .set({ groupId })
      .where(and(eq(media.id, id), eq(media.workspaceId, workspaceId), isNull(media.groupId)));
  }
}
