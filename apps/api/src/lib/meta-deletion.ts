import type { Env } from "../env";
import { decryptCredentials, encryptCredentials } from "./secrets";

export const META_NETWORKS = ["instagram", "threads", "facebook"] as const;

export type MetaAccountRow = {
  id: string;
  network: string;
  credentialsJson: string | null;
};

export function metaAccountMatchesUser(creds: Record<string, string> | undefined, userId: string): boolean {
  if (!userId || !creds) return false;
  return creds.metaUserId === userId || creds.threadsUserId === userId || creds.facebookUserId === userId;
}

export function stripMetaTokens(creds: Record<string, string>): Record<string, string> {
  const next = { ...creds };
  delete next.accessToken;
  delete next.refreshToken;
  delete next.pendingPagesJson;
  return next;
}

export async function wipeMatchingMetaAccounts(
  env: Env,
  rows: MetaAccountRow[],
  metaUserId: string,
  persist: (id: string, tokenCipher: string, credentialsJson: string | null, status: string) => Promise<void>,
): Promise<string[]> {
  const deleted: string[] = [];
  for (const row of rows) {
    if (!META_NETWORKS.includes(row.network as (typeof META_NETWORKS)[number])) continue;
    const creds = await decryptCredentials(env, row.credentialsJson);
    if (!metaAccountMatchesUser(creds, metaUserId)) continue;
    const stripped = stripMetaTokens(creds || {});
    await persist(row.id, "pending", await encryptCredentials(env, stripped), "revoked");
    deleted.push(row.id);
  }
  return deleted;
}
