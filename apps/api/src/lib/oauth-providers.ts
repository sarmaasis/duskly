import type { Env } from "../env";
import type { Network } from "./networks";
import { REDDIT_UA, applyTokenResponse } from "./oauth-tokens";

export type AuthorizeInput = {
  env: Env;
  network: Network;
  redirectUri: string;
  state: string;
  challenge: string;
  instance: string;
  mastodonClientId?: string;
};

export type FacebookPage = {
  id: string;
  name: string;
  accessToken: string;
  igUserId?: string;
  igUsername?: string;
};

/** User-facing Instagram label — username when Graph has it, otherwise the IG id. Never the Facebook Page name. */
export function instagramAccountLabel(page: { igUsername?: string; igUserId?: string }): string {
  const user = page.igUsername?.replace(/^@/, "").trim();
  if (user) return `@${user}`;
  return page.igUserId || "";
}

export function facebookConnectHandle(network: "instagram" | "facebook", pages: FacebookPage[]): string {
  if (pages.length === 1) {
    return network === "instagram" ? instagramAccountLabel(pages[0]) || "instagram-account" : pages[0].name;
  }
  return network === "instagram" ? "instagram · pick an account" : `${network} · pick a Page`;
}

/** Stored on Instagram Login credentials so publish uses graph.instagram.com, not a Page token. */
export const INSTAGRAM_LOGIN_AUTH = "instagram_login";

/** Instagram API with Instagram Login (graph.instagram.com). Playground uses v25.0; Facebook Graph stays v21.0. */
export const INSTAGRAM_GRAPH_VERSION = "v25.0";
const INSTAGRAM_GRAPH_BASE = `https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}`;

export function isInstagramLoginCreds(creds?: Record<string, string> | null): boolean {
  return creds?.authKind === INSTAGRAM_LOGIN_AUTH;
}

export function instagramLoginConfigured(env: Env): boolean {
  return !!(env.INSTAGRAM_APP_ID?.trim() && env.INSTAGRAM_APP_SECRET?.trim());
}

export function instagramAppCreds(env: Env): { appId: string; appSecret: string } {
  return { appId: (env.INSTAGRAM_APP_ID || "").trim(), appSecret: (env.INSTAGRAM_APP_SECRET || "").trim() };
}

export function oauthConfigured(env: Env, network: Network): boolean {
  if (network === "x") return !!(env.X_CLIENT_ID && env.X_CLIENT_SECRET);
  if (network === "linkedin") return !!(env.LINKEDIN_CLIENT_ID && env.LINKEDIN_CLIENT_SECRET);
  if (network === "mastodon") return true;
  if (network === "instagram") {
    return instagramLoginConfigured(env) || !!(env.META_APP_ID?.trim() && env.META_APP_SECRET?.trim());
  }
  if (network === "threads" || network === "facebook") {
    return !!(env.META_APP_ID?.trim() && env.META_APP_SECRET?.trim());
  }
  if (network === "youtube") return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  if (network === "reddit") return !!(env.REDDIT_CLIENT_ID && env.REDDIT_CLIENT_SECRET);
  if (network === "slack") return !!(env.SLACK_CLIENT_ID && env.SLACK_CLIENT_SECRET);
  return false;
}

export function buildAuthorizeUrl(input: AuthorizeInput): string {
  const { env, network, redirectUri, state, challenge, instance } = input;
  if (network === "x") {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: env.X_CLIENT_ID!,
      redirect_uri: redirectUri,
      scope: "tweet.read tweet.write media.write users.read offline.access",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
    return `https://x.com/i/oauth2/authorize?${params}`;
  }
  if (network === "linkedin") {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: env.LINKEDIN_CLIENT_ID!,
      redirect_uri: redirectUri,
      scope: "openid profile w_member_social",
      state,
    });
    return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
  }
  if (network === "mastodon") {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: input.mastodonClientId || env.MASTODON_CLIENT_ID!,
      redirect_uri: redirectUri,
      scope: "read write",
      state,
    });
    return `${instance}/oauth/authorize?${params}`;
  }
  if (network === "threads") {
    const params = new URLSearchParams({
      client_id: env.META_APP_ID!,
      redirect_uri: redirectUri,
      scope: "threads_basic,threads_content_publish",
      response_type: "code",
      state,
    });
    return `https://threads.com/oauth/authorize?${params}`;
  }
  if (network === "instagram" && instagramLoginConfigured(env)) {
    const { appId } = instagramAppCreds(env);
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "instagram_business_basic,instagram_business_content_publish",
      state,
    });
    return `https://www.instagram.com/oauth/authorize?${params}`;
  }
  if (network === "instagram" || network === "facebook") {
    const scope =
      network === "instagram"
        ? "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement"
        : "pages_manage_posts,pages_read_engagement,pages_show_list";
    const params = new URLSearchParams({
      client_id: env.META_APP_ID!,
      redirect_uri: redirectUri,
      state,
      scope,
      response_type: "code",
    });
    return `https://www.facebook.com/v21.0/dialog/oauth?${params}`;
  }
  if (network === "youtube") {
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID!,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/youtube.upload",
      access_type: "offline",
      prompt: "consent",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }
  if (network === "slack") {
    // chat:write.public lets the bot post to a public channel the user picked
    // even if nobody has /invited the bot yet. Channel picker still uses channels:read / groups:read.
    const params = new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID!,
      scope: "chat:write,channels:read,groups:read,chat:write.public",
      redirect_uri: redirectUri,
      state,
    });
    return `https://slack.com/oauth/v2/authorize?${params}`;
  }
  const params = new URLSearchParams({
    client_id: env.REDDIT_CLIENT_ID!,
    response_type: "code",
    state,
    redirect_uri: redirectUri,
    duration: "permanent",
    scope: "submit identity",
  });
  return `https://www.reddit.com/api/v1/authorize?${params}`;
}

export async function registerMastodonApp(
  instance: string,
  redirectUri: string,
  env: Env,
): Promise<{ clientId: string; clientSecret: string }> {
  const normalized = instance.replace(/\/$/, "");
  const overrideHost = (env.MASTODON_INSTANCE || "https://mastodon.social").replace(/\/$/, "");
  if (env.MASTODON_CLIENT_ID && env.MASTODON_CLIENT_SECRET && normalized === overrideHost) {
    return { clientId: env.MASTODON_CLIENT_ID, clientSecret: env.MASTODON_CLIENT_SECRET };
  }
  const res = await fetch(`${normalized}/api/v1/apps`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_name: env.APP_NAME || "Duskly",
      redirect_uris: redirectUri,
      scopes: "read write",
      website: env.WEB_ORIGIN || "https://duskly.site",
    }),
  });
  if (!res.ok) throw new Error(`mastodon_app_register_failed:${res.status}`);
  const data = (await res.json()) as { client_id?: string; client_secret?: string };
  if (!data.client_id || !data.client_secret) throw new Error("mastodon_app_register_incomplete");
  return { clientId: data.client_id, clientSecret: data.client_secret };
}

export function metaAppCreds(env: Env): { appId: string; appSecret: string } {
  return { appId: (env.META_APP_ID || "").trim(), appSecret: (env.META_APP_SECRET || "").trim() };
}

/** Short UI/query reason. Never include tokens, auth codes, or secrets. */
export function safeOauthReason(raw: string | undefined | null, max = 80): string {
  const s = (raw || "").replace(/\+/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return "";
  if (/access[_-]?token|client_secret|app_secret|code_verifier|authorization code|bearer\s+[a-z0-9]|EAA[A-Za-z0-9]{8,}/i.test(s)) {
    return "";
  }
  return s.replace(/[^\w .:,()\-/]/g, "").slice(0, max).trim();
}

/** Graph error_message for the accounts banner. Never include tokens, auth codes, or secrets. */
export function safeOauthDetail(raw: string | undefined | null, max = 160): string {
  let s = (raw || "").replace(/\+/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return "";
  s = s.replace(/EAA[A-Za-z0-9]{8,}/g, "");
  s = s.replace(/access_token[=:][^\s&]+/gi, "");
  s = s.replace(/client_secret[=:][^\s&]+/gi, "");
  s = s.replace(/\bcode=[A-Za-z0-9_-]{8,}/gi, "");
  if (/EAA[A-Za-z0-9]{8,}|client_secret|app_secret|code_verifier|bearer\s+[a-z0-9]/i.test(s)) return "";
  return s.replace(/[^\w .:,()\-/'#]/g, "").slice(0, max).trim();
}

export function classifyGraphOauthMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("redirect_uri")) return "redirect_uri";
  if (
    m.includes("professional") ||
    m.includes("business or creator") ||
    m.includes("not a business") ||
    m.includes("personal account") ||
    m.includes("creator account required")
  ) {
    return "not_professional";
  }
  if (m.includes("application secret") || m.includes("app secret") || m.includes("client secret") || m.includes("invalid client")) {
    return "bad_secret";
  }
  if (m.includes("been used") || m.includes("already used")) return "code_used";
  if (m.includes("session has expired") || m.includes("code has expired") || m.includes("expired")) return "code_expired";
  if (m.includes("verification code") || m.includes("invalid verification")) return "bad_code";
  return "";
}

function graphErrorFields(tok: Record<string, unknown>): { message: string; code: string } {
  const err = tok.error;
  const fromObj =
    err && typeof err === "object"
      ? {
          message: typeof (err as { message?: unknown }).message === "string" ? (err as { message: string }).message : "",
          code: (err as { code?: unknown }).code != null ? String((err as { code: unknown }).code) : "",
        }
      : { message: typeof err === "string" ? err : "", code: "" };
  const topMessage = typeof tok.error_message === "string" ? tok.error_message : "";
  const topCode = tok.error_code != null ? String(tok.error_code) : "";
  return { message: fromObj.message || topMessage, code: fromObj.code || topCode };
}

export function graphOauthReason(tok: Record<string, unknown>): string {
  const { message, code } = graphErrorFields(tok);
  return classifyGraphOauthMessage(message) || (code ? `graph_${code}` : "") || safeOauthReason(message) || "token_failed";
}

export function graphOauthDetail(tok: Record<string, unknown>): string {
  return safeOauthDetail(graphErrorFields(tok).message);
}

/** Facebook token endpoint is JSON; older Graph replies were form-encoded (including errors). */
export function parseFacebookTokenPayload(text: string): Record<string, unknown> {
  const raw = (text || "").trim();
  if (!raw) return {};
  try {
    const body = JSON.parse(raw) as unknown;
    if (body && typeof body === "object") return body as Record<string, unknown>;
  } catch {
    /* form-encoded fallback */
  }
  const params = new URLSearchParams(raw.includes("=") ? raw : "");
  const access = params.get("access_token");
  if (access) {
    const expires = params.get("expires_in") || params.get("expires");
    return {
      access_token: access,
      token_type: params.get("token_type") || "bearer",
      ...(expires ? { expires_in: Number(expires) } : {}),
    };
  }
  const err = params.get("error") || params.get("error_reason");
  const errMsg = params.get("error_message") || params.get("error_description");
  const errCode = params.get("error_code");
  if (err || errMsg) {
    return {
      error: {
        message: errMsg || err || "",
        type: err || "OAuthException",
        ...(errCode ? { code: Number(errCode) || errCode } : {}),
      },
    };
  }
  return {};
}

export type FacebookTokenResult =
  | { ok: true; accessToken: string }
  | { ok: false; reason: string; detail?: string };

/** Graph oauth/access_token is POST-only — GET returns error 100 "Unsupported request - method type: get". */
export async function exchangeFacebookUserToken(
  env: Env,
  code: string,
  redirectUri: string,
): Promise<FacebookTokenResult> {
  const { appId, appSecret } = metaAppCreds(env);
  if (!appId || !appSecret) return { ok: false, reason: "missing_secret" };
  try {
    const tokenRes = await fetch("https://graph.facebook.com/v21.0/oauth/access_token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
      }),
    });
    const tok = parseFacebookTokenPayload(await tokenRes.text());
    const access = typeof tok.access_token === "string" ? tok.access_token : "";
    if (!tokenRes.ok || !access || tok.error) {
      return { ok: false, reason: graphOauthReason(tok), detail: graphOauthDetail(tok) || undefined };
    }
    return { ok: true, accessToken: access };
  } catch {
    return { ok: false, reason: "exchange" };
  }
}

export async function exchangeLongLivedFacebookToken(env: Env, shortLived: string): Promise<string> {
  if (!shortLived) return shortLived;
  const { appId, appSecret } = metaAppCreds(env);
  try {
    const res = await fetch("https://graph.facebook.com/v21.0/oauth/access_token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: shortLived,
      }),
    });
    const tok = parseFacebookTokenPayload(await res.text());
    const next = typeof tok.access_token === "string" ? tok.access_token : "";
    return next || shortLived;
  } catch {
    return shortLived;
  }
}

function instagramObjectRow(tok: Record<string, unknown>): Record<string, unknown> {
  const data = tok.data;
  if (Array.isArray(data) && data[0] && typeof data[0] === "object") return data[0] as Record<string, unknown>;
  return tok;
}

function instagramAccessTokenFromPayload(tok: Record<string, unknown>): string {
  const row = instagramObjectRow(tok);
  return typeof row.access_token === "string" && row.access_token ? row.access_token : "";
}

function instagramExpiresInFromPayload(tok: Record<string, unknown>): number | undefined {
  const raw = instagramObjectRow(tok).expires_in ?? tok.expires_in;
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Official short-lived Instagram Login tokens last 1 hour. Longer expires_in means skip ig_exchange_token. */
const INSTAGRAM_SHORT_LIVED_MAX_SEC = 3600;

function instagramTokenAlreadyLongLived(expiresIn?: number): boolean {
  return typeof expiresIn === "number" && expiresIn > INSTAGRAM_SHORT_LIVED_MAX_SEC;
}

function isUnsupportedGraphMethodType(tok: Record<string, unknown>): boolean {
  const { message, code } = graphErrorFields(tok);
  return code === "100" && /unsupported request.*method type/i.test(message);
}

export type InstagramUserTokenResult =
  | { ok: true; accessToken: string; userId?: string; expiresIn?: number }
  | { ok: false; reason: string; detail?: string };

/** POST https://api.instagram.com/oauth/access_token — Instagram Login code exchange. Docs: data[0].access_token. */
export async function exchangeInstagramUserToken(
  env: Env,
  code: string,
  redirectUri: string,
): Promise<InstagramUserTokenResult> {
  const { appId, appSecret } = instagramAppCreds(env);
  if (!appId || !appSecret) return { ok: false, reason: "missing_secret" };
  try {
    const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      }),
    });
    const tok = parseFacebookTokenPayload(await tokenRes.text());
    const access = instagramAccessTokenFromPayload(tok);
    if (!tokenRes.ok || !access || tok.error) {
      return { ok: false, reason: graphOauthReason(tok), detail: graphOauthDetail(tok) || undefined };
    }
    const expiresIn = instagramExpiresInFromPayload(tok);
    const userId = String(instagramObjectRow(tok).user_id || "").trim();
    return {
      ok: true,
      accessToken: access,
      ...(userId ? { userId } : {}),
      ...(expiresIn ? { expiresIn } : {}),
    };
  } catch {
    return { ok: false, reason: "exchange" };
  }
}

export type InstagramLongLivedResult =
  | { ok: true; accessToken: string; expiresIn?: number }
  | { ok: false; reason: string; detail?: string };

/**
 * GET https://graph.instagram.com/access_token?grant_type=ig_exchange_token
 * Unversioned. /v25.0/access_token is not this endpoint and returns Graph 100 method type get.
 * https://developers.facebook.com/docs/instagram-platform/reference/access_token/
 * A method-type 100 must not fail connect — keep the short-lived token.
 */
export async function exchangeLongLivedInstagramToken(
  env: Env,
  shortLived: string,
  shortLivedExpiresIn?: number,
): Promise<InstagramLongLivedResult> {
  if (!shortLived) return { ok: false, reason: "exchange" };
  if (instagramTokenAlreadyLongLived(shortLivedExpiresIn)) {
    return { ok: true, accessToken: shortLived, expiresIn: shortLivedExpiresIn };
  }
  const { appSecret } = instagramAppCreds(env);
  if (!appSecret) return { ok: false, reason: "missing_secret" };
  try {
    const res = await fetch(
      `https://graph.instagram.com/access_token?${new URLSearchParams({
        grant_type: "ig_exchange_token",
        client_secret: appSecret,
        access_token: shortLived,
      })}`,
      { method: "GET" },
    );
    const tok = parseFacebookTokenPayload(await res.text());
    const next = instagramAccessTokenFromPayload(tok);
    if (!res.ok || !next || tok.error) {
      if (isUnsupportedGraphMethodType(tok)) {
        return {
          ok: true,
          accessToken: shortLived,
          ...(shortLivedExpiresIn ? { expiresIn: shortLivedExpiresIn } : {}),
        };
      }
      return { ok: false, reason: graphOauthReason(tok), detail: graphOauthDetail(tok) || undefined };
    }
    const expiresIn = instagramExpiresInFromPayload(tok);
    return { ok: true, accessToken: next, ...(expiresIn ? { expiresIn } : {}) };
  } catch {
    return { ok: false, reason: "exchange" };
  }
}

export type InstagramLoginProfileResult =
  | { ok: true; userId: string; username?: string }
  | { ok: false; reason: string; detail?: string };

export async function fetchInstagramLoginProfile(accessToken: string): Promise<InstagramLoginProfileResult> {
  if (!accessToken) return { ok: false, reason: "profile" };
  const readProfile = async (fields: string) => {
    const res = await fetch(
      `${INSTAGRAM_GRAPH_BASE}/me?${new URLSearchParams({
        fields,
        access_token: accessToken,
      })}`,
    );
    const data = parseFacebookTokenPayload(await res.text());
    return { res, data };
  };
  try {
    let { res, data } = await readProfile("id,user_id,username,name");
    if (!res.ok || data.error) {
      const reason = graphOauthReason(data);
      if (reason === "not_professional") {
        return { ok: false, reason, detail: graphOauthDetail(data) || undefined };
      }
      ({ res, data } = await readProfile("id,username"));
    }
    if (!res.ok || data.error) {
      const reason = graphOauthReason(data);
      return {
        ok: false,
        reason: reason === "token_failed" ? "profile" : reason,
        detail: graphOauthDetail(data) || undefined,
      };
    }
    const userId = String((data as { user_id?: unknown }).user_id || data.id || "").trim();
    const username = instagramUsernameField(data);
    if (!userId && !username) return { ok: false, reason: "profile" };
    return { ok: true, userId, ...(username ? { username } : {}) };
  } catch {
    return { ok: false, reason: "profile" };
  }
}

function instagramUsernameField(data: Record<string, unknown>): string {
  const raw = typeof data.username === "string" ? data.username : typeof data.name === "string" ? data.name : "";
  return raw.replace(/^@/, "").trim();
}

/** Username for an Instagram Login token. /me can omit it; /{ig-user-id}?fields=username is the fallback. */
export async function fetchInstagramLoginUsername(accessToken: string, userId?: string): Promise<string | undefined> {
  if (!accessToken) return undefined;
  const profile = await fetchInstagramLoginProfile(accessToken);
  if (profile.ok && profile.username) return profile.username;
  const id = (profile.ok && profile.userId) || userId || "";
  if (!id) return undefined;
  try {
    const res = await fetch(
      `${INSTAGRAM_GRAPH_BASE}/${id}?${new URLSearchParams({
        fields: "id,user_id,username,name",
        access_token: accessToken,
      })}`,
    );
    const data = parseFacebookTokenPayload(await res.text());
    if (!res.ok || data.error) return undefined;
    return instagramUsernameField(data) || undefined;
  } catch {
    return undefined;
  }
}

export type FacebookPagesResult = {
  pages: FacebookPage[];
  error?: { code?: string; message?: string };
};

async function fetchInstagramUsername(pageToken: string, igUserId: string): Promise<string | undefined> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${igUserId}?${new URLSearchParams({
        fields: "username",
        access_token: pageToken,
      })}`,
    );
    const data = parseFacebookTokenPayload(await res.text()) as { username?: string };
    const username = data.username?.replace(/^@/, "").trim();
    return username || undefined;
  } catch {
    return undefined;
  }
}

export async function listFacebookPages(userToken: string, requireIg: boolean): Promise<FacebookPagesResult> {
  if (!userToken) return { pages: [] };
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?${new URLSearchParams({
        fields: "id,name,access_token,instagram_business_account{id,username}",
        access_token: userToken,
      })}`,
    );
    const data = parseFacebookTokenPayload(await res.text()) as {
      error?: unknown;
      data?: Array<{
        id?: string;
        name?: string;
        access_token?: string;
        instagram_business_account?: { id?: string; username?: string };
      }>;
    };
    if (!res.ok || data.error) {
      const { message, code } = graphErrorFields(data);
      return {
        pages: [],
        error: {
          ...(code ? { code } : {}),
          ...(safeOauthDetail(message) ? { message: safeOauthDetail(message) } : {}),
        },
      };
    }
    const pages: FacebookPage[] = [];
    for (const p of data.data || []) {
      if (!p.id || !p.access_token) continue;
      const igUserId = p.instagram_business_account?.id;
      if (requireIg && !igUserId) continue;
      let igUsername = p.instagram_business_account?.username?.replace(/^@/, "").trim() || undefined;
      if (requireIg && igUserId && !igUsername) {
        igUsername = await fetchInstagramUsername(p.access_token, igUserId);
      }
      pages.push({
        id: p.id,
        name: p.name || p.id,
        accessToken: p.access_token,
        ...(igUserId ? { igUserId } : {}),
        ...(igUsername ? { igUsername } : {}),
      });
    }
    return { pages };
  } catch {
    return { pages: [], error: { message: "pages" } };
  }
}

export async function fetchFacebookPageInstagramAccount(
  pageToken: string,
  pageId: string,
): Promise<{ pageName?: string; igUserId?: string; igUsername?: string }> {
  if (!pageToken || !pageId) return {};
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}?${new URLSearchParams({
        fields: "name,instagram_business_account{id,username}",
        access_token: pageToken,
      })}`,
    );
    const data = parseFacebookTokenPayload(await res.text()) as {
      error?: unknown;
      name?: string;
      instagram_business_account?: { id?: string; username?: string };
    };
    if (!res.ok || data.error) return {};
    const igUserId = data.instagram_business_account?.id;
    const igUsername = data.instagram_business_account?.username?.replace(/^@/, "").trim();
    return {
      ...(data.name ? { pageName: data.name } : {}),
      ...(igUserId ? { igUserId } : {}),
      ...(igUsername ? { igUsername } : {}),
    };
  } catch {
    return {};
  }
}

export async function exchangeThreadsUserToken(
  env: Env,
  code: string,
  redirectUri: string,
): Promise<{ accessToken: string; userId: string; handle: string; refreshToken?: string; expiresIn?: number }> {
  const tokenRes = await fetch(
    `https://graph.threads.net/oauth/access_token?${new URLSearchParams({
      client_id: env.META_APP_ID!,
      client_secret: env.META_APP_SECRET!,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    })}`,
  );
  if (!tokenRes.ok) throw new Error("threads_token_failed");
  const tok = (await tokenRes.json()) as {
    access_token?: string;
    user_id?: string | number;
    expires_in?: number;
  };
  if (!tok.access_token) throw new Error("threads_token_failed");

  let accessToken = tok.access_token;
  const longRes = await fetch(
    `https://graph.threads.net/access_token?${new URLSearchParams({
      grant_type: "th_exchange_token",
      client_secret: env.META_APP_SECRET!,
      access_token: accessToken,
    })}`,
  );
  if (longRes.ok) {
    const longTok = (await longRes.json()) as { access_token?: string; expires_in?: number };
    if (longTok.access_token) accessToken = longTok.access_token;
    if (longTok.expires_in) tok.expires_in = longTok.expires_in;
  }

  const me = await fetch(
    `https://graph.threads.net/v1.0/me?${new URLSearchParams({
      fields: "id,username",
      access_token: accessToken,
    })}`,
  );
  const meJson = (await me.json()) as { id?: string; username?: string };
  return {
    accessToken,
    userId: String(meJson.id || tok.user_id || ""),
    handle: meJson.username ? `@${meJson.username}` : "threads-user",
    expiresIn: tok.expires_in,
  };
}

export function normalizeSubreddit(raw: string | undefined | null): string {
  return (raw || "").trim().replace(/^\/?r\//i, "");
}

export async function facebookUserId(userToken: string): Promise<string> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/me?${new URLSearchParams({ fields: "id", access_token: userToken })}`,
    );
    if (!res.ok) return "";
    const data = (await res.json()) as { id?: string };
    return data.id || "";
  } catch {
    return "";
  }
}

export function credsFromTokenJson(
  base: Record<string, string>,
  tok: { access_token?: string; refresh_token?: string; expires_in?: number },
): Record<string, string> {
  return applyTokenResponse(base, tok);
}

export { REDDIT_UA };
