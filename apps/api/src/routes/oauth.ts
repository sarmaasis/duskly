import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { socialAccount } from "../db/schema";
import type { Env } from "../env";
import { assertWorkspaceAccess } from "../lib/workspace";
import { assertChannelLimit, planErrorResponse } from "../lib/entitlements";
import { NETWORK_META, type Network } from "../lib/networks";
import { encryptCredentials, encryptSecret } from "../lib/secrets";

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

function oauthConfigured(env: Env, network: Network): boolean {
  if (network === "x") return !!(env.X_CLIENT_ID && env.X_CLIENT_SECRET);
  if (network === "linkedin") return !!(env.LINKEDIN_CLIENT_ID && env.LINKEDIN_CLIENT_SECRET);
  if (network === "mastodon") return !!(env.MASTODON_CLIENT_ID && env.MASTODON_CLIENT_SECRET);
  if (network === "instagram" || network === "threads" || network === "facebook") {
    return !!(env.META_APP_ID && env.META_APP_SECRET);
  }
  if (network === "youtube") return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  if (network === "reddit") return !!(env.REDDIT_CLIENT_ID && env.REDDIT_CLIENT_SECRET);
  if (network === "slack") return !!(env.SLACK_CLIENT_ID && env.SLACK_CLIENT_SECRET);
  if (network === "bluesky") return true;
  return NETWORK_META[network]?.connect === "token";
}

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

oauthRoutes.get("/status", async (c) => {
  const workspaceId = c.req.query("workspaceId");
  if (!workspaceId) return c.json({ error: "workspaceId required" }, 400);
  const ws = await assertWorkspaceAccess(c.env, workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  const status: Record<string, boolean> = {};
  for (const n of Object.keys(NETWORK_META) as Network[]) {
    status[n] = oauthConfigured(c.env, n);
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

  await c.env.KV.put(
    `oauth:${state}`,
    JSON.stringify({
      workspaceId,
      userId: c.get("userId"),
      network,
      verifier,
      instance,
      groupId: c.req.query("groupId") || null,
    }),
    { expirationTtl: 600 },
  );

  const redirectUri = `${c.env.BETTER_AUTH_URL}/v1/accounts/oauth/${network}/callback`;
  let url: string;

  if (network === "x") {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: c.env.X_CLIENT_ID!,
      redirect_uri: redirectUri,
      scope: "tweet.read tweet.write users.read offline.access",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
    url = `https://twitter.com/i/oauth2/authorize?${params}`;
  } else if (network === "linkedin") {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: c.env.LINKEDIN_CLIENT_ID!,
      redirect_uri: redirectUri,
      scope: "openid profile w_member_social",
      state,
    });
    url = `https://www.linkedin.com/oauth/v2/authorization?${params}`;
  } else if (network === "mastodon") {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: c.env.MASTODON_CLIENT_ID!,
      redirect_uri: redirectUri,
      scope: "read write",
      state,
    });
    url = `${instance}/oauth/authorize?${params}`;
  } else if (network === "instagram" || network === "threads" || network === "facebook") {
    const scopes =
      network === "instagram"
        ? "instagram_basic,instagram_content_publish,pages_show_list"
        : network === "threads"
          ? "threads_basic,threads_content_publish"
          : "pages_manage_posts,pages_read_engagement,pages_show_list";
    const params = new URLSearchParams({
      client_id: c.env.META_APP_ID!,
      redirect_uri: redirectUri,
      state,
      scope: scopes,
      response_type: "code",
    });
    url = `https://www.facebook.com/v21.0/dialog/oauth?${params}`;
  } else if (network === "youtube") {
    const params = new URLSearchParams({
      client_id: c.env.GOOGLE_CLIENT_ID!,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/youtube.force-ssl",
      access_type: "offline",
      prompt: "consent",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
    url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  } else if (network === "slack") {
    const params = new URLSearchParams({
      client_id: c.env.SLACK_CLIENT_ID!,
      scope: "chat:write,channels:read,groups:read,chat:write.public",
      redirect_uri: redirectUri,
      state,
    });
    url = `https://slack.com/oauth/v2/authorize?${params}`;
  } else {
    // reddit
    const params = new URLSearchParams({
      client_id: c.env.REDDIT_CLIENT_ID!,
      response_type: "code",
      state,
      redirect_uri: redirectUri,
      duration: "permanent",
      scope: "submit identity",
    });
    url = `https://www.reddit.com/api/v1/authorize?${params}`;
  }

  return c.redirect(url);
});

oauthRoutes.get("/:network/callback", async (c) => {
  const network = c.req.param("network") as Network;
  const code = c.req.query("code");
  const state = c.req.query("state");
  const err = c.req.query("error");
  if (err || !code || !state) {
    return c.redirect(`${c.env.WEB_ORIGIN}/app/accounts?oauth=error`);
  }

  const raw = await c.env.KV.get(`oauth:${state}`);
  await c.env.KV.delete(`oauth:${state}`);
  if (!raw) return c.redirect(`${c.env.WEB_ORIGIN}/app/accounts?oauth=expired`);

  const stored = JSON.parse(raw) as {
    workspaceId: string;
    userId: string;
    network: Network;
    verifier: string;
    instance: string;
    groupId?: string | null;
  };
  if (stored.network !== network) return c.redirect(`${c.env.WEB_ORIGIN}/app/accounts?oauth=mismatch`);

  try {
    await assertChannelLimit(c.env, stored.workspaceId, 1);
  } catch (e) {
    const pe = planErrorResponse(e);
    if (pe) return pe;
    throw e;
  }

  const redirectUri = `${c.env.BETTER_AUTH_URL}/v1/accounts/oauth/${network}/callback`;
  let accessToken = "";
  let handle = "";
  let credentials: Record<string, string> = {};

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
      if (!tokenRes.ok) return c.redirect(`${c.env.WEB_ORIGIN}/app/accounts?oauth=token_failed`);
      const tok = (await tokenRes.json()) as { access_token: string };
      accessToken = tok.access_token;
      const me = await fetch("https://api.x.com/2/users/me", {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const meJson = (await me.json()) as { data?: { username?: string; id?: string } };
      handle = meJson.data?.username ? `@${meJson.data.username}` : "x-user";
      credentials = { accessToken, userId: meJson.data?.id || "" };
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
      if (!tokenRes.ok) return c.redirect(`${c.env.WEB_ORIGIN}/app/accounts?oauth=token_failed`);
      const tok = (await tokenRes.json()) as { access_token: string };
      accessToken = tok.access_token;
      const me = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const meJson = (await me.json()) as { sub?: string; name?: string; email?: string };
      const authorUrn = meJson.sub ? `urn:li:person:${meJson.sub}` : "";
      handle = meJson.name || meJson.email || "linkedin-user";
      credentials = { accessToken, authorUrn };
    } else if (network === "mastodon") {
      const instance = stored.instance;
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: c.env.MASTODON_CLIENT_ID!,
        client_secret: c.env.MASTODON_CLIENT_SECRET!,
      });
      const tokenRes = await fetch(`${instance}/oauth/token`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!tokenRes.ok) return c.redirect(`${c.env.WEB_ORIGIN}/app/accounts?oauth=token_failed`);
      const tok = (await tokenRes.json()) as { access_token: string };
      accessToken = tok.access_token;
      const me = await fetch(`${instance}/api/v1/accounts/verify_credentials`, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const meJson = (await me.json()) as { username?: string; acct?: string };
      handle = meJson.acct || meJson.username || "mastodon-user";
      credentials = { accessToken, instance };
    } else if (network === "instagram" || network === "threads" || network === "facebook") {
      const tokenRes = await fetch(
        `https://graph.facebook.com/v21.0/oauth/access_token?${new URLSearchParams({
          client_id: c.env.META_APP_ID!,
          client_secret: c.env.META_APP_SECRET!,
          redirect_uri: redirectUri,
          code,
        })}`,
      );
      if (!tokenRes.ok) return c.redirect(`${c.env.WEB_ORIGIN}/app/accounts?oauth=token_failed`);
      const tok = (await tokenRes.json()) as { access_token: string };
      accessToken = tok.access_token;
      const me = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${accessToken}`);
      const meJson = (await me.json()) as { id?: string; name?: string };
      handle = meJson.name || `${network}-user`;
      credentials = {
        accessToken,
        pageId: meJson.id || "",
        igUserId: meJson.id || "",
        threadsUserId: meJson.id || "",
      };
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
      if (!tokenRes.ok) return c.redirect(`${c.env.WEB_ORIGIN}/app/accounts?oauth=token_failed`);
      const tok = (await tokenRes.json()) as { access_token: string };
      accessToken = tok.access_token;
      handle = "youtube-channel";
      credentials = { accessToken };
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
          "user-agent": "duskly/1.0",
        },
        body,
      });
      if (!tokenRes.ok) return c.redirect(`${c.env.WEB_ORIGIN}/app/accounts?oauth=token_failed`);
      const tok = (await tokenRes.json()) as { access_token: string };
      accessToken = tok.access_token;
      const me = await fetch("https://oauth.reddit.com/api/v1/me", {
        headers: { authorization: `Bearer ${accessToken}`, "user-agent": "duskly/1.0" },
      });
      const meJson = (await me.json()) as { name?: string };
      handle = meJson.name ? `u/${meJson.name}` : "reddit-user";
      credentials = { accessToken, subreddit: "" };
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
      if (!tokenRes.ok) return c.redirect(`${c.env.WEB_ORIGIN}/app/accounts?oauth=token_failed`);
      const tok = (await tokenRes.json()) as {
        ok?: boolean;
        error?: string;
        access_token?: string;
        team?: { id?: string; name?: string };
        bot_user_id?: string;
      };
      if (!tok.ok || !tok.access_token) {
        return c.redirect(`${c.env.WEB_ORIGIN}/app/accounts?oauth=token_failed`);
      }
      accessToken = tok.access_token;
      handle = tok.team?.name ? `slack · ${tok.team.name}` : "slack-workspace";
      credentials = {
        botToken: accessToken,
        teamId: tok.team?.id || "",
        botUserId: tok.bot_user_id || "",
      };
    } else {
      return c.redirect(`${c.env.WEB_ORIGIN}/app/accounts?oauth=unsupported`);
    }
  } catch {
    return c.redirect(`${c.env.WEB_ORIGIN}/app/accounts?oauth=token_failed`);
  }

  const id = crypto.randomUUID();
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
    status: network === "slack" ? "needs_channel" : "active",
    createdAt: new Date(),
  });

  return c.redirect(
    `${c.env.WEB_ORIGIN}/app/accounts?oauth=ok&network=${network}${network === "slack" ? `&accountId=${id}` : ""}`,
  );
});
