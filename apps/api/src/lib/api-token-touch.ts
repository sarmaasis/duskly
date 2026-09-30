import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { apiToken } from "../db/schema";

/** Skip the write when this token was already touched in the last minute. */
export async function touchApiToken(db: ReturnType<typeof drizzle>, row: { id: string; lastUsedAt: Date | null }) {
  const last = row.lastUsedAt ? row.lastUsedAt.getTime() : 0;
  if (Date.now() - last < 60_000) return;
  await db.update(apiToken).set({ lastUsedAt: new Date() }).where(eq(apiToken.id, row.id));
}
