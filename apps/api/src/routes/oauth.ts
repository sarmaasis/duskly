import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { socialAccount } from "../db/schema";
import type { Env } from "../env";
import { assertWorkspaceAccess } from "../lib/workspace";
import { assertChannelLimit, planErrorResponse } from "../lib/entitlements";
import type { Network } from "../lib/networks";

export const oauthRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

function oauthConfigured(env: Env, network: Network): boolean {
  if (network === "x") return !!(env.X_CLIENT_ID && env.X_CLIENT_SECRET);
  if (network === "linkedin") return !!(env.LINKEDIN_CLIENT_ID && env.LINKEDIN_CLIENT_SECRET);
  if (network === "mastodon") return !!(env.MASTODON_CLIENT_ID && env.MASTODON_CLIENT_SECRET);
  return false;
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

/** Must be registered before /:network/* so "status" is not captured as a network. */
oauthRoutes.get("/status", async (c) => {
  const workspaceId = c.req.query("workspaceId");
  if (!workspaceId) return c.json({ error: "workspaceId required" }, 400);
  const ws = await assertWorkspaceAccess(c.env, workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  return c.json({
    x: oauthConfigured(c.env, "x"),
    linkedin: oauthConfigured(c.env, "linkedin"),
    mastodon: oauthConfigured(c.env, "mastodon"),
    bluesky: true,
  });
});

oauthRoutes.get("/:network/start", async (c) => {
  const network = c.req.param("network") as Network;
  const workspaceId = c.req.query("workspaceId");
  if (!workspaceId) return c.json({ error: "workspaceId required" }, 400);
  if (network === "bluesky") return c.json({ error: "use_app_password" }, 400);
  if (!["x", "linkedin", "mastodon"].includes(network)) return c.json({ error: "unsupported" }, 400);

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
  } else {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: c.env.MASTODON_CLIENT_ID!,
      redirect_uri: redirectUri,
      scope: "read write",
      state,
    });
    url = `${instance}/oauth/authorize?${params}`;
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
  } else {
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
  }

  const id = crypto.randomUUID();
  const db = drizzle(c.env.DB);
  await db.insert(socialAccount).values({
    id,
    workspaceId: stored.workspaceId,
    network,
    handle,
    externalId: handle,
    tokenCipher: accessToken,
    credentialsJson: JSON.stringify(credentials),
    status: "active",
    createdAt: new Date(),
  });

  return c.redirect(`${c.env.WEB_ORIGIN}/app/accounts?oauth=ok&network=${network}`);
});
