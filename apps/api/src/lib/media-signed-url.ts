import type { Env } from "../env";
import { hmacSign } from "./workspace";

/** Instagram (and other fetch-the-URL providers) get ~1 hour to pull the object. */
export const PUBLIC_MEDIA_TTL_SEC = 3600;
const MAX_FUTURE_SEC = PUBLIC_MEDIA_TTL_SEC * 2;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signPublicMediaSig(env: Env, mediaId: string, expSec: number): Promise<string> {
  return hmacSign(env.TOKEN_ENCRYPTION_KEY, `${mediaId}.${expSec}`);
}

export const PROD_API_ORIGIN = "https://api.duskly.site";

/** Absolute API origin for provider-fetched URLs. Never a relative path. */
export function apiPublicOrigin(env: Env): string {
  const raw = (env.BETTER_AUTH_URL || "").trim().replace(/\/$/, "");
  if (/^https?:\/\//i.test(raw)) return raw;
  return PROD_API_ORIGIN;
}

export async function signPublicMediaUrl(env: Env, mediaId: string, nowMs = Date.now()): Promise<string> {
  const exp = Math.floor(nowMs / 1000) + PUBLIC_MEDIA_TTL_SEC;
  const sig = await signPublicMediaSig(env, mediaId, exp);
  return `${apiPublicOrigin(env)}/v1/media/${mediaId}/public?exp=${exp}&sig=${sig}`;
}

export async function verifyPublicMediaSig(
  env: Env,
  mediaId: string,
  expRaw: string | undefined,
  sig: string | undefined,
  nowMs = Date.now(),
): Promise<boolean> {
  if (!env.TOKEN_ENCRYPTION_KEY?.trim() || !mediaId || !sig) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || !Number.isInteger(exp)) return false;
  const nowSec = Math.floor(nowMs / 1000);
  if (exp <= nowSec) return false;
  if (exp > nowSec + MAX_FUTURE_SEC) return false;
  const expected = await signPublicMediaSig(env, mediaId, exp);
  return timingSafeEqual(expected, sig);
}
