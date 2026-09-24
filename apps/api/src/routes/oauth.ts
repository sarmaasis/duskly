import { Hono, type Context } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { socialAccount } from "../db/schema";
import type { Env } from "../env";
import { assertWorkspaceAccess } from "../lib/workspace";
import { assertChannelLimit, planErrorResponse } from "../lib/entitlements";
import { NETWORKS, NETWORK_META, type Network } from "../lib/networks";
import { encryptCredentials, encryptSecret } from "../lib/secrets";
import {
  buildAuthorizeUrl,
  credsFromTokenJson,
  exchangeLongLivedFacebookToken,
  exchangeThreadsUserToken,
  graphOauthReason,
  listFacebookPages,
  metaAppCreds,
  oauthConfigured,
  facebookUserId,
  normalizeSubreddit,
  parseFacebookTokenPayload,
  registerMastodonApp,
  REDDIT_UA,
  safeOauthReason,
} from "../lib/oauth-providers";
import { applyTokenResponse } from "../lib/oauth-tokens";
import { apiPublicOrigin } from "../lib/media-signed-url";

export const oauthRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

const OAUTH_NETWORKS = new Set<Network>([
  "x",
  "linkedin",
  "mastodon",
  "instagram",
  "threads",
  "facebook",
  "youtube",
  "reddit",
  "slack",
]);

function b64url(buf: ArrayBuffer | Uint8Array | string): string {
  const bytes =
    typeof buf === "string"
      ? new TextEncoder().encode(buf)
      : buf instanceof Uint8Array
        ? buf
        : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function pkcePair() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: b64url(digest) };
}

function webRedirect(env: Env, qs: string) {
  const origin = (env.WEB_ORIGIN || "https://duskly.site").replace(/\/$/, "");
  return `${origin}/app/accounts?${qs}`;
}

function oauthCallbackUri(env: Env, network: string) {
  return `${apiPublicOrigin(env)}/v1/accounts/oauth/${network}/callback`;
}

function oauthFailQs(network: string, oauth: string, reason?: string) {
  const q = new URLSearchParams({ oauth, network });
  const safe = safeOauthReason(reason);
  if (safe) q.set("reason", safe);
  return q.toString();
}

oauthRoutes.get("/status", async (c) => {
  const workspaceId = c.req.query("workspaceId");
  if (!workspaceId) return c.json({ error: "workspaceId required" }, 400);
  const ws = await assertWorkspaceAccess(c.env, workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  const status: Record<string, boolean> = {};
  for (const n of NETWORKS) {
    status[n] = oauthConfigured(c.env, n) || NETWORK_META[n]?.connect === "token";
  }
  return c.json(status);
});

oauthRoutes.get("/:network/start", async (c) => {
  const network = c.req.param("network") as Network;
  const workspaceId = c.req.query("workspaceId");
  if (!workspaceId) return c.json({ error: "workspaceId required" }, 400);
  if (NETWORK_META[network]?.connect === "token") {
    return c.json({ error: "use_token_connect", message: `${network} uses API token / webhook connect, not OAuth` }, 400);
  }
  if (!OAUTH_NETWORKS.has(network)) return c.json({ error: "unsupported" }, 400);

  const ws = await assertWorkspaceAccess(c.env, workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);

  if (!oauthConfigured(c.env, network)) {
    return c.json(
      {
        error: "oauth_not_configured",
        message: `${network} OAuth client credentials are not set on the API. Connect stays queued until env is configured.`,
      },
      503,
    );
  }

  const state = crypto.randomUUID();
  const { verifier, challenge } = await pkcePair();
  const instance = (c.req.query("instance") || c.env.MASTODON_INSTANCE || "https://mastodon.social").replace(
    /\/$/,
    "",
  );

  const redirectUri = oauthCallbackUri(c.env, network);
  let mastodonClientId: string | undefined;
  let mastodonClientSecret: string | undefined;
  if (network === "mastodon") {
    try {
      const app = await registerMastodonApp(instance, redirectUri, c.env);
      mastodonClientId = app.clientId;
      mastodonClientSecret = app.clientSecret;
    } catch {
      return c.json(
        { error: "mastodon_app_register_failed", message: `Could not register an OAuth app on ${instance}` },
        502,
      );
    }
  }

  await c.env.KV.put(
    `oauth:${state}`,
    JSON.stringify({
      workspaceId,
      userId: c.get("userId"),
      network,
      verifier,
      instance,
      groupId: c.req.query("groupId") || null,
      mastodonClientId,
      mastodonClientSecret,
      subreddit: normalizeSubreddit(c.req.query("subreddit")),
      redirectUri,
    }),
    { expirationTtl: 600 },
  );

  const url = buildAuthorizeUrl({
    env: c.env,
    network,
    redirectUri,
    state,
    challenge,
    instance,
    mastodonClientId,
  });
  return c.redirect(url);
});

oauthRoutes.get("/:network/callback", async (c) => {
  const network = c.req.param("network") as Network;
  const fail = (qs: string) => c.redirect(webRedirect(c.env, qs));
  try {
    return await completeOAuthCallback(c, network, fail);
  } catch {
    return fail("oauth=error");
  }
});

async function completeOAuthCallback(
  c: Context<{ Bindings: Env; Variables: { userId: string } }>,
  network: Network,
  fail: (qs: string) => Response,
) {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const err = c.req.query("error");
  if (err || !code || !state) {
    const reason = err || c.req.query("error_reason") || (!code ? "missing_code" : "missing_state");
    return fail(oauthFailQs(network, "error", reason));
  }

  let raw: string | null = null;
  try {
    raw = await c.env.KV.get(`oauth:${state}`);
    await c.env.KV.delete(`oauth:${state}`);
  } catch {
    return fail("oauth=error");
  }
  if (!raw) return fail("oauth=expired");

  let stored: {
    workspaceId: string;
    userId: string;
    network: Network;
    verifier: string;
    instance: string;
    groupId?: string | null;
    mastodonClientId?: string;
    mastodonClientSecret?: string;
    subreddit?: string;
    redirectUri?: string;
  };
  try {
    stored = JSON.parse(raw) as typeof stored;
  } catch {
    return fail("oauth=error");
  }
  if (stored.network !== network) return fail("oauth=mismatch");

  try {
    await assertChannelLimit(c.env, stored.workspaceId, 1);
  } catch (e) {
    if (planErrorResponse(e)) return fail(oauthFailQs(network, "limit", "channel_limit"));
    return fail(oauthFailQs(network, "error"));
  }

  const redirectUri = stored.redirectUri || oauthCallbackUri(c.env, network);
  let accessToken = "";
  let handle = "";
  let credentials: Record<string, string> = {};
  let status: string = "active";

  try {
    if (network === "x") {
      const body = new URLSearchParams({
        code,
        grant_type: "authorization_code",
        client_id: c.env.X_CLIENT_ID!,
        redirect_uri: redirectUri,
        code_verifier: stored.verifier,
      });
      const basic = btoa(`${c.env.X_CLIENT_ID}:${c.env.X_CLIENT_SECRET}`);
      const tokenRes = await fetch("https://api.x.com/2/oauth2/token", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          authorization: `Basic ${basic}`,
        },
        body,
      });
      if (!tokenRes.ok) return c.redirect(webRedirect(c.env, "oauth=token_failed"));
      const tok = (await tokenRes.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      };
      accessToken = tok.access_token;
      const me = await fetch("https://api.x.com/2/users/me", {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const meJson = (await me.json()) as { data?: { username?: string; id?: string } };
      handle = meJson.data?.username ? `@${meJson.data.username}` : "x-user";
      credentials = applyTokenResponse({ userId: meJson.data?.id || "" }, tok);
    } else if (network === "linkedin") {
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: c.env.LINKEDIN_CLIENT_ID!,
        client_secret: c.env.LINKEDIN_CLIENT_SECRET!,
      });
      const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!tokenRes.ok) return c.redirect(webRedirect(c.env, "oauth=token_failed"));
      const tok = (await tokenRes.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      };
      accessToken = tok.access_token;
      const me = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const meJson = (await me.json()) as { sub?: string; name?: string; email?: string };
      const authorUrn = meJson.sub ? `urn:li:person:${meJson.sub}` : "";
      handle = meJson.name || meJson.email || "linkedin-user";
      credentials = applyTokenResponse({ authorUrn }, tok);
    } else if (network === "mastodon") {
      const instance = stored.instance;
      const clientId = stored.mastodonClientId || c.env.MASTODON_CLIENT_ID!;
      const clientSecret = stored.mastodonClientSecret || c.env.MASTODON_CLIENT_SECRET!;
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      });
      const tokenRes = await fetch(`${instance}/oauth/token`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!tokenRes.ok) return c.redirect(webRedirect(c.env, "oauth=token_failed"));
      const tok = (await tokenRes.json()) as { access_token: string; refresh_token?: string; expires_in?: number };
      accessToken = tok.access_token;
      const me = await fetch(`${instance}/api/v1/accounts/verify_credentials`, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const meJson = (await me.json()) as { username?: string; acct?: string };
      handle = meJson.acct || meJson.username || "mastodon-user";
      credentials = applyTokenResponse(
        { instance, mastodonClientId: clientId, mastodonClientSecret: clientSecret },
        tok,
      );
    } else if (network === "threads") {
      const th = await exchangeThreadsUserToken(c.env, code, redirectUri);
      accessToken = th.accessToken;
      handle = th.handle;
      credentials = applyTokenResponse(
        { threadsUserId: th.userId, metaUserId: th.userId },
        { access_token: th.accessToken, expires_in: th.expiresIn },
      );
      if (th.userId) await c.env.KV.put(`meta-user:${th.userId}`, stored.workspaceId);
    } else if (network === "instagram" || network === "facebook") {
      const { appId, appSecret } = metaAppCreds(c.env);
      if (!appId || !appSecret) {
        return fail(oauthFailQs(network, "token_failed", "missing_secret"));
      }
      let tok: Record<string, unknown> = {};
      let tokenResOk = false;
      try {
        const tokenRes = await fetch(
          `https://graph.facebook.com/v21.0/oauth/access_token?${new URLSearchParams({
            client_id: appId,
            client_secret: appSecret,
            redirect_uri: redirectUri,
            code,
          })}`,
        );
        tokenResOk = tokenRes.ok;
        tok = parseFacebookTokenPayload(await tokenRes.text());
      } catch {
        return fail(oauthFailQs(network, "token_failed", "exchange"));
      }
      const access = typeof tok.access_token === "string" ? tok.access_token : "";
      if (!tokenResOk || !access || tok.error) {
        return fail(oauthFailQs(network, "token_failed", graphOauthReason(tok)));
      }
      const longLived = await exchangeLongLivedFacebookToken(c.env, access);
      const metaUserId = await facebookUserId(longLived);
      const pages = await listFacebookPages(longLived, network === "instagram");
      if (!pages.length) {
        return fail(`oauth=no_page&network=${network}`);
      }
      if (pages.length === 1) {
        const page = pages[0];
        accessToken = page.accessToken;
        handle = page.name;
        credentials = {
          accessToken: page.accessToken,
          pageId: page.id,
          pageName: page.name,
          ...(page.igUserId ? { igUserId: page.igUserId } : {}),
          ...(metaUserId ? { metaUserId } : {}),
        };
      } else {
        accessToken = pages[0].accessToken;
        handle = `${network} · pick a Page`;
        status = "needs_page";
        credentials = {
          accessToken: pages[0].accessToken,
          pendingPagesJson: JSON.stringify(pages),
          ...(metaUserId ? { metaUserId } : {}),
        };
      }
      if (metaUserId) {
        try {
          await c.env.KV.put(`meta-user:${metaUserId}`, stored.workspaceId);
        } catch {
          /* best-effort map for Meta data-deletion */
        }
      }
    } else if (network === "youtube") {
      const body = new URLSearchParams({
        code,
        client_id: c.env.GOOGLE_CLIENT_ID!,
        client_secret: c.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: stored.verifier,
      });
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!tokenRes.ok) return c.redirect(webRedirect(c.env, "oauth=token_failed"));
      const tok = (await tokenRes.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      };
      accessToken = tok.access_token;
      handle = "youtube-channel";
      credentials = credsFromTokenJson({}, tok);
    } else if (network === "reddit") {
      const basic = btoa(`${c.env.REDDIT_CLIENT_ID}:${c.env.REDDIT_CLIENT_SECRET}`);
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      });
      const tokenRes = await fetch("https://www.reddit.com/api/v1/access_token", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          authorization: `Basic ${basic}`,
          "user-agent": REDDIT_UA,
        },
        body,
      });
      if (!tokenRes.ok) return c.redirect(webRedirect(c.env, "oauth=token_failed"));
      const tok = (await tokenRes.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      };
      accessToken = tok.access_token;
      const me = await fetch("https://oauth.reddit.com/api/v1/me", {
        headers: { authorization: `Bearer ${accessToken}`, "user-agent": REDDIT_UA },
      });
      const meJson = (await me.json()) as { name?: string };
      handle = meJson.name ? `u/${meJson.name}` : "reddit-user";
      credentials = applyTokenResponse({ subreddit: stored.subreddit || "" }, tok);
    } else if (network === "slack") {
      const body = new URLSearchParams({
        code,
        client_id: c.env.SLACK_CLIENT_ID!,
        client_secret: c.env.SLACK_CLIENT_SECRET!,
        redirect_uri: redirectUri,
      });
      const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!tokenRes.ok) return c.redirect(webRedirect(c.env, "oauth=token_failed"));
      const tok = (await tokenRes.json()) as {
        ok?: boolean;
        error?: string;
        access_token?: string;
        team?: { id?: string; name?: string };
        bot_user_id?: string;
      };
      if (!tok.ok || !tok.access_token) {
        return c.redirect(webRedirect(c.env, "oauth=token_failed"));
      }
      accessToken = tok.access_token;
      handle = tok.team?.name ? `slack · ${tok.team.name}` : "slack-workspace";
      status = "needs_channel";
      credentials = {
        botToken: accessToken,
        teamId: tok.team?.id || "",
        botUserId: tok.bot_user_id || "",
      };
    } else {
      return c.redirect(webRedirect(c.env, "oauth=unsupported"));
    }
  } catch {
    return fail("oauth=token_failed");
  }

  const id = crypto.randomUUID();
  try {
    const db = drizzle(c.env.DB);
    await db.insert(socialAccount).values({
      id,
      workspaceId: stored.workspaceId,
      network,
      handle,
      externalId: handle,
      tokenCipher: await encryptSecret(c.env, accessToken),
      credentialsJson: await encryptCredentials(c.env, credentials),
      groupId: stored.groupId || null,
      status,
      createdAt: new Date(),
    });
  } catch {
    return fail("oauth=error");
  }

  const extra =
    network === "slack" || status === "needs_page"
      ? `&accountId=${id}`
      : "";
  return c.redirect(webRedirect(c.env, `oauth=ok&network=${network}${extra}`));
}
