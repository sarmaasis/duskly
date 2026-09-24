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
};

export function oauthConfigured(env: Env, network: Network): boolean {
  if (network === "x") return !!(env.X_CLIENT_ID && env.X_CLIENT_SECRET);
  if (network === "linkedin") return !!(env.LINKEDIN_CLIENT_ID && env.LINKEDIN_CLIENT_SECRET);
  if (network === "mastodon") return true;
  if (network === "instagram" || network === "threads" || network === "facebook") {
    return !!(env.META_APP_ID && env.META_APP_SECRET);
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
      scope: "tweet.read tweet.write users.read offline.access",
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

export async function exchangeLongLivedFacebookToken(env: Env, shortLived: string): Promise<string> {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?${new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: env.META_APP_ID!,
      client_secret: env.META_APP_SECRET!,
      fb_exchange_token: shortLived,
    })}`,
  );
  if (!res.ok) return shortLived;
  const tok = (await res.json()) as { access_token?: string };
  return tok.access_token || shortLived;
}

export async function listFacebookPages(userToken: string, requireIg: boolean): Promise<FacebookPage[]> {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?${new URLSearchParams({
      fields: "id,name,access_token,instagram_business_account",
      access_token: userToken,
    })}`,
  );
  if (!res.ok) return [];
  const data = (await res.json()) as {
    data?: Array<{
      id?: string;
      name?: string;
      access_token?: string;
      instagram_business_account?: { id?: string };
    }>;
  };
  const pages: FacebookPage[] = [];
  for (const p of data.data || []) {
    if (!p.id || !p.access_token) continue;
    const igUserId = p.instagram_business_account?.id;
    if (requireIg && !igUserId) continue;
    pages.push({ id: p.id, name: p.name || p.id, accessToken: p.access_token, igUserId });
  }
  return pages;
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
