import type { Env } from "../env";
import type { Network } from "./networks";
import { linkedinAppCreds } from "./oauth-providers";

export const REDDIT_UA = "duskly/1.0 (https://duskly.site)";

export function tokenExpiryMs(expiresInSec: number | undefined, skewSec = 60): string {
  const sec = Number.isFinite(expiresInSec) && (expiresInSec as number) > 0 ? (expiresInSec as number) : 3600;
  return String(Date.now() + Math.max(30, sec - skewSec) * 1000);
}

export function accessTokenExpired(creds: Record<string, string> | undefined): boolean {
  const raw = creds?.expiresAt;
  if (!raw) return false;
  const at = Number(raw);
  return Number.isFinite(at) && at <= Date.now();
}

export function applyTokenResponse(
  creds: Record<string, string>,
  tok: { access_token?: string; refresh_token?: string; expires_in?: number },
): Record<string, string> {
  const next = { ...creds };
  if (tok.access_token) next.accessToken = tok.access_token;
  if (tok.refresh_token) next.refreshToken = tok.refresh_token;
  if (tok.expires_in != null || tok.access_token) next.expiresAt = tokenExpiryMs(tok.expires_in);
  return next;
}

type RefreshOk = { ok: true; creds: Record<string, string>; accessToken: string };
type RefreshSkip = { ok: true; creds: Record<string, string>; accessToken: string; skipped: true };
type RefreshFail = { ok: false; reason: string };

export async function refreshAccessToken(
  env: Env,
  network: Network,
  creds: Record<string, string>,
): Promise<RefreshOk | RefreshSkip | RefreshFail> {
  const current = creds.accessToken || creds.botToken || "";
  if (!accessTokenExpired(creds) || !creds.refreshToken) {
    return { ok: true, creds, accessToken: current, skipped: true };
  }

  if (network === "x") {
    if (!env.X_CLIENT_ID || !env.X_CLIENT_SECRET) return { ok: false, reason: "X OAuth client is not configured" };
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: creds.refreshToken,
      client_id: env.X_CLIENT_ID,
    });
    const basic = btoa(`${env.X_CLIENT_ID}:${env.X_CLIENT_SECRET}`);
    const res = await fetch("https://api.x.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: `Basic ${basic}`,
      },
      body,
    });
    if (!res.ok) return { ok: false, reason: `X token refresh failed (${res.status})` };
    const tok = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!tok.access_token) return { ok: false, reason: "X token refresh returned no access_token" };
    const next = applyTokenResponse(creds, tok);
    return { ok: true, creds: next, accessToken: tok.access_token };
  }

  if (network === "linkedin" || network === "linkedin-page") {
    const linkedInCreds = linkedinAppCreds(env, network);
    if (!linkedInCreds.clientId || !linkedInCreds.clientSecret) {
      return { ok: false, reason: "LinkedIn OAuth client is not configured" };
    }
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: creds.refreshToken,
      client_id: linkedInCreds.clientId,
      client_secret: linkedInCreds.clientSecret,
    });
    const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) return { ok: false, reason: `LinkedIn token refresh failed (${res.status})` };
    const tok = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!tok.access_token) return { ok: false, reason: "LinkedIn token refresh returned no access_token" };
    const next = applyTokenResponse(creds, tok);
    return { ok: true, creds: next, accessToken: tok.access_token };
  }

  if (network === "youtube") {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      return { ok: false, reason: "Google OAuth client is not configured" };
    }
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: creds.refreshToken,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
    });
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) return { ok: false, reason: `YouTube token refresh failed (${res.status})` };
    const tok = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!tok.access_token) return { ok: false, reason: "YouTube token refresh returned no access_token" };
    const next = applyTokenResponse(creds, tok);
    return { ok: true, creds: next, accessToken: tok.access_token };
  }

  if (network === "threads") {
    const token = creds.refreshToken || creds.accessToken;
    if (!token) return { ok: false, reason: "Threads token is missing" };
    const res = await fetch(
      `https://graph.threads.net/refresh_access_token?${new URLSearchParams({
        grant_type: "th_refresh_token",
        access_token: token,
      })}`,
    );
    if (!res.ok) return { ok: false, reason: `Threads token refresh failed (${res.status})` };
    const tok = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!tok.access_token) return { ok: false, reason: "Threads token refresh returned no access_token" };
    const next = applyTokenResponse(creds, { ...tok, refresh_token: tok.access_token });
    return { ok: true, creds: next, accessToken: tok.access_token };
  }

  if (network === "reddit") {
    if (!env.REDDIT_CLIENT_ID || !env.REDDIT_CLIENT_SECRET) {
      return { ok: false, reason: "Reddit OAuth client is not configured" };
    }
    const basic = btoa(`${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`);
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: creds.refreshToken,
    });
    const res = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: `Basic ${basic}`,
        "user-agent": REDDIT_UA,
      },
      body,
    });
    if (!res.ok) return { ok: false, reason: `Reddit token refresh failed (${res.status})` };
    const tok = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!tok.access_token) return { ok: false, reason: "Reddit token refresh returned no access_token" };
    const next = applyTokenResponse(creds, tok);
    return { ok: true, creds: next, accessToken: tok.access_token };
  }

  return { ok: true, creds, accessToken: current, skipped: true };
}
