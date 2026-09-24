import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "../index";
import type { Env } from "../env";
import {
  INSTAGRAM_LOGIN_AUTH,
  buildAuthorizeUrl,
  facebookConnectHandle,
  fetchFacebookPageInstagramAccount,
  graphOauthReason,
  instagramAccountLabel,
  instagramLoginConfigured,
  listFacebookPages,
  normalizeSubreddit,
  oauthConfigured,
  parseFacebookTokenPayload,
  safeOauthDetail,
  safeOauthReason,
} from "../lib/oauth-providers";
import { applyTokenResponse, refreshAccessToken, tokenExpiryMs } from "../lib/oauth-tokens";
import { parseMetaSignedRequest } from "../routes/meta-deletion";
import { encryptCredentials, decryptCredentials } from "../lib/secrets";
import { wipeMatchingMetaAccounts } from "../lib/meta-deletion";
import { assertChannelLimit } from "../lib/entitlements";

vi.mock("../lib/entitlements", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/entitlements")>();
  return {
    ...actual,
    assertChannelLimit: vi.fn().mockResolvedValue(undefined),
  };
});

const here = dirname(fileURLToPath(import.meta.url));

const env = {
  X_CLIENT_ID: "x-id",
  X_CLIENT_SECRET: "x-secret",
  LINKEDIN_CLIENT_ID: "li-id",
  LINKEDIN_CLIENT_SECRET: "li-secret",
  META_APP_ID: "meta-id",
  META_APP_SECRET: "meta-secret",
  GOOGLE_CLIENT_ID: "g-id",
  GOOGLE_CLIENT_SECRET: "g-secret",
  REDDIT_CLIENT_ID: "r-id",
  REDDIT_CLIENT_SECRET: "r-secret",
  SLACK_CLIENT_ID: "s-id",
  SLACK_CLIENT_SECRET: "s-secret",
  WEB_ORIGIN: "https://duskly.site",
  APP_NAME: "Duskly",
} as Env;

beforeEach(() => {
  vi.mocked(assertChannelLimit).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("OAuth authorize URLs", () => {
  const base = {
    env,
    redirectUri: "https://api.duskly.site/v1/accounts/oauth/x/callback",
    state: "st",
    challenge: "ch",
    instance: "https://mastodon.social",
  };

  it("X uses x.com PKCE authorize and publish scopes", () => {
    const url = buildAuthorizeUrl({ ...base, network: "x" });
    expect(url.startsWith("https://x.com/i/oauth2/authorize?")).toBe(true);
    const q = new URL(url).searchParams;
    expect(q.get("scope")).toBe("tweet.read tweet.write media.write users.read offline.access");
    expect(q.get("code_challenge_method")).toBe("S256");
    expect(q.get("redirect_uri")).toBe("https://api.duskly.site/v1/accounts/oauth/x/callback");
  });

  it("Instagram adds pages_read_engagement", () => {
    const url = buildAuthorizeUrl({
      ...base,
      network: "instagram",
      redirectUri: "https://api.duskly.site/v1/accounts/oauth/instagram/callback",
    });
    expect(url).toContain("facebook.com/v21.0/dialog/oauth");
    expect(new URL(url).searchParams.get("scope")).toContain("pages_read_engagement");
    expect(new URL(url).searchParams.get("scope")).toContain("instagram_content_publish");
  });

  it("Instagram Login uses instagram.com authorize when INSTAGRAM_APP_ID and secret are set", () => {
    const url = buildAuthorizeUrl({
      ...base,
      env: { ...env, INSTAGRAM_APP_ID: "ig-app-id", INSTAGRAM_APP_SECRET: "ig-app-secret" },
      network: "instagram",
      redirectUri: "https://api.duskly.site/v1/accounts/oauth/instagram/callback",
    });
    expect(url.startsWith("https://www.instagram.com/oauth/authorize?")).toBe(true);
    expect(url).not.toContain("facebook.com");
    const q = new URL(url).searchParams;
    expect(q.get("client_id")).toBe("ig-app-id");
    expect(q.get("response_type")).toBe("code");
    expect(q.get("scope")).toBe("instagram_business_basic,instagram_business_content_publish");
    expect(q.get("redirect_uri")).toBe("https://api.duskly.site/v1/accounts/oauth/instagram/callback");
    expect(q.get("state")).toBe("st");
  });

  it("Instagram is configured from Instagram Login secrets even without META_APP_*", () => {
    expect(instagramLoginConfigured({} as Env)).toBe(false);
    expect(oauthConfigured({} as Env, "instagram")).toBe(false);
    expect(oauthConfigured({ META_APP_ID: "m", META_APP_SECRET: "s" } as Env, "instagram")).toBe(true);
    expect(
      oauthConfigured({ INSTAGRAM_APP_ID: "ig", INSTAGRAM_APP_SECRET: "ig-s" } as Env, "instagram"),
    ).toBe(true);
    expect(oauthConfigured({ INSTAGRAM_APP_ID: "ig", INSTAGRAM_APP_SECRET: "  " } as Env, "instagram")).toBe(false);
  });

  it("Threads uses threads.com authorize, not Facebook Login", () => {
    const url = buildAuthorizeUrl({
      ...base,
      network: "threads",
      redirectUri: "https://api.duskly.site/v1/accounts/oauth/threads/callback",
    });
    expect(url.startsWith("https://threads.com/oauth/authorize?")).toBe(true);
    expect(url).not.toContain("facebook.com");
    expect(new URL(url).searchParams.get("scope")).toBe("threads_basic,threads_content_publish");
  });

  it("Facebook keeps Page publish scopes", () => {
    const url = buildAuthorizeUrl({
      ...base,
      network: "facebook",
      redirectUri: "https://api.duskly.site/v1/accounts/oauth/facebook/callback",
    });
    expect(url).toContain("facebook.com/v21.0/dialog/oauth");
    const q = new URL(url).searchParams;
    expect(q.get("scope")).toBe("pages_manage_posts,pages_read_engagement,pages_show_list");
    expect(q.get("redirect_uri")).toBe("https://api.duskly.site/v1/accounts/oauth/facebook/callback");
    expect(q.get("client_id")).toBe("meta-id");
    expect(q.get("response_type")).toBe("code");
  });

  it("YouTube asks only for youtube.upload (upload-only, no force-ssl)", () => {
    const url = buildAuthorizeUrl({
      ...base,
      network: "youtube",
      redirectUri: "https://api.duskly.site/v1/accounts/oauth/youtube/callback",
    });
    expect(new URL(url).searchParams.get("scope")).toBe("https://www.googleapis.com/auth/youtube.upload");
    expect(url).not.toContain("youtube.force-ssl");
  });

  it("Slack keeps chat:write.public", () => {
    const url = buildAuthorizeUrl({ ...base, network: "slack" });
    expect(new URL(url).searchParams.get("scope")).toContain("chat:write.public");
  });

  it("Reddit is a web app with permanent submit identity", () => {
    const url = buildAuthorizeUrl({ ...base, network: "reddit" });
    const q = new URL(url).searchParams;
    expect(url).toContain("reddit.com/api/v1/authorize");
    expect(q.get("duration")).toBe("permanent");
    expect(q.get("scope")).toBe("submit identity");
  });

  it("Mastodon is always configured (per-instance app register)", () => {
    expect(oauthConfigured({} as Env, "mastodon")).toBe(true);
    expect(oauthConfigured(env, "x")).toBe(true);
    expect(oauthConfigured({} as Env, "x")).toBe(false);
  });
});

describe("refresh tokens", () => {
  it("applyTokenResponse persists refresh_token and expiresAt", () => {
    const creds = applyTokenResponse({ userId: "1" }, {
      access_token: "a1",
      refresh_token: "r1",
      expires_in: 3600,
    });
    expect(creds.accessToken).toBe("a1");
    expect(creds.refreshToken).toBe("r1");
    expect(Number(creds.expiresAt)).toBeGreaterThan(Date.now());
  });

  it("refreshes X when access token is expired and saves the new refresh_token", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "a2", refresh_token: "r2", expires_in: 7200 }),
    });
    vi.stubGlobal("fetch", fetch);
    const result = await refreshAccessToken(env, "x", {
      accessToken: "old",
      refreshToken: "r1",
      expiresAt: String(Date.now() - 1000),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.accessToken).toBe("a2");
      expect(result.creds.refreshToken).toBe("r2");
    }
    expect(fetch).toHaveBeenCalledTimes(1);
    const called = String(fetch.mock.calls[0][0]);
    expect(called).toBe("https://api.x.com/2/oauth2/token");
    const body = fetch.mock.calls[0][1].body as URLSearchParams;
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("r1");
  });

  it("skips refresh when token is still valid", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const result = await refreshAccessToken(env, "linkedin", {
      accessToken: "live",
      refreshToken: "r1",
      expiresAt: tokenExpiryMs(3600),
    });
    expect(result.ok).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("Reddit subreddit", () => {
  it("normalizes r/ prefix and OAuth callback persists it in credentials", () => {
    expect(normalizeSubreddit("r/duskly")).toBe("duskly");
    expect(normalizeSubreddit("/r/duskly")).toBe("duskly");
    expect(normalizeSubreddit("duskly")).toBe("duskly");
    const creds = applyTokenResponse({ subreddit: normalizeSubreddit("r/duskly") }, {
      access_token: "tok",
      refresh_token: "ref",
      expires_in: 3600,
    });
    expect(creds.subreddit).toBe("duskly");
    expect(creds.accessToken).toBe("tok");
  });

  it("OAuth start stores subreddit from the query and callback writes stored.subreddit", () => {
    const src = readFileSync(join(here, "../routes/oauth.ts"), "utf8");
    expect(src).toContain("normalizeSubreddit(c.req.query(\"subreddit\"))");
    expect(src).toContain("subreddit: stored.subreddit || \"\"");
    const web = readFileSync(join(here, "../../../web/src/app/accounts/accounts.page.ts"), "utf8");
    expect(web).toContain('q.set("subreddit", this.subreddit.trim())');
    expect(web).toContain("oauthFailureMessage");
    expect(web).toContain("oauthQuery");
    expect(web).toContain('this.oauthQuery("detail")');
    expect(web).toContain("#_=_");
    expect(web).toContain("OAuth failed — credentials or consent rejected");
    expect(web).toContain("Facebook login succeeded but Pages could not be loaded.");
    expect(web).toContain("Set TOKEN_ENCRYPTION_KEY on the API.");
    expect(web).toContain("could not encrypt the token (${detail})");
    expect(web).toContain("Pick an Instagram account…");
    expect(web).toContain("Instagram account connected");
    expect(web).toContain("pick the Instagram account to connect.");
    expect(web).toContain("INSTAGRAM_APP_ID");
    expect(web).toContain("professional (Business or Creator)");
    expect(web).toContain("Instagram OAuth failed");
    expect(web).toContain("`${label} OAuth failed — Graph error ${code}: ${detail}`");
    expect(web).not.toContain("Instagram connected — pick a Page");
  });
});

describe("Meta data-deletion", () => {
  it("GET /v1/meta/data-deletion returns Meta's JSON shape without auth", async () => {
    const res = await worker.fetch(
      new Request("https://api.duskly.test/v1/meta/data-deletion"),
      { WEB_ORIGIN: "https://duskly.site" } as Env,
      {} as ExecutionContext,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { url: string; confirmation_code: string };
    expect(body.confirmation_code.length).toBeGreaterThan(4);
    expect(body.url).toContain("/data-deletion?code=");
  });

  it("GET /v1/meta-deletion is an unauthenticated alias of /v1/meta/data-deletion", async () => {
    const res = await worker.fetch(
      new Request("https://api.duskly.test/v1/meta-deletion"),
      { WEB_ORIGIN: "https://duskly.site" } as Env,
      {} as ExecutionContext,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { url: string; confirmation_code: string };
    expect(body.confirmation_code.length).toBeGreaterThan(4);
    expect(body.url).toContain("/data-deletion?code=");
  });

  it("verifies a signed_request HMAC when META_APP_SECRET is set", async () => {
    const payload = btoa(JSON.stringify({ user_id: "99", algorithm: "HMAC-SHA256" }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("meta-secret"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
    let sig = "";
    for (const b of new Uint8Array(sigBuf)) sig += String.fromCharCode(b);
    const encodedSig = btoa(sig).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const parsed = await parseMetaSignedRequest(`${encodedSig}.${payload}`, "meta-secret");
    expect(parsed?.user_id).toBe("99");
  });

  it("deletes stored Instagram/Facebook/Threads tokens for the signed user", async () => {
    const encEnv = { TOKEN_ENCRYPTION_KEY: "a".repeat(64) } as Env;
    const ig = await encryptCredentials(encEnv, { accessToken: "IG_TOKEN", metaUserId: "99", igUserId: "1784" });
    const threads = await encryptCredentials(encEnv, { accessToken: "TH_TOKEN", threadsUserId: "99" });
    const facebook = await encryptCredentials(encEnv, { accessToken: "FB_TOKEN", metaUserId: "99", pageId: "111" });
    const other = await encryptCredentials(encEnv, { accessToken: "X_TOKEN" });
    const persist = vi.fn(async () => undefined);
    const deleted = await wipeMatchingMetaAccounts(
      encEnv,
      [
        { id: "ig1", network: "instagram", credentialsJson: ig },
        { id: "th1", network: "threads", credentialsJson: threads },
        { id: "fb1", network: "facebook", credentialsJson: facebook },
        { id: "x1", network: "x", credentialsJson: other },
        { id: "ig2", network: "instagram", credentialsJson: await encryptCredentials(encEnv, { accessToken: "OTHER", metaUserId: "12" }) },
      ],
      "99",
      persist,
    );
    expect(deleted.sort()).toEqual(["fb1", "ig1", "th1"]);
    expect(persist).toHaveBeenCalledTimes(3);
    for (const call of persist.mock.calls) {
      expect(call[1]).toBe("pending");
      expect(call[3]).toBe("revoked");
      const creds = await decryptCredentials(encEnv, call[2]);
      expect(creds?.accessToken).toBeUndefined();
    }
  });

  it("records a confirmation code in KV when the request cannot be tied to a user", async () => {
    const store = new Map<string, string>();
    const res = await worker.fetch(
      new Request("https://api.duskly.test/v1/meta/data-deletion", { method: "POST" }),
      {
        WEB_ORIGIN: "https://duskly.site",
        KV: {
          put: async (k: string, v: string) => {
            store.set(k, v);
          },
          get: async (k: string) => store.get(k) ?? null,
        },
      } as unknown as Env,
      {} as ExecutionContext,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { confirmation_code: string };
    const recorded = [...store.entries()].find(([k]) => k.startsWith("meta-deletion:"));
    expect(recorded?.[0]).toBe(`meta-deletion:${body.confirmation_code}`);
    expect(JSON.parse(recorded![1]).userId).toBeNull();
  });
});

describe("tracked legal + callback docs", () => {
  it("web app exposes /privacy /terms /data-deletion", () => {
    const src = readFileSync(join(here, "../../../web/src/app/app.routes.ts"), "utf8");
    expect(src).toContain('path: "privacy"');
    expect(src).toContain('path: "terms"');
    expect(src).toContain('path: "data-deletion"');
  });

  it("documents production callback URLs next to OAuth clients", () => {
    const src = readFileSync(join(here, "../../.dev.vars.example"), "utf8");
    expect(src).toContain("https://api.duskly.site/v1/accounts/oauth/{network}/callback");
    expect(src).toContain("https://api.duskly.site/v1/accounts/oauth/x/callback");
    expect(src).toContain("https://api.duskly.site/v1/meta/data-deletion");
    expect(src).toContain("https://www.googleapis.com/auth/youtube.upload");
    expect(src).toContain("https://api.duskly.site/v1/media/{id}/public?exp=&sig=");
    expect(src).toContain("INSTAGRAM_APP_ID=");
    expect(src).toContain("INSTAGRAM_APP_SECRET=");
    expect(src).toContain("INSTAGRAM_WEBHOOK_VERIFY_TOKEN=");
    expect(src).toContain("https://api.duskly.site/v1/instagram/webhook");
    expect(src).toContain("API setup with Instagram login");
    const deploy = readFileSync(join(here, "../../../../docs/DEPLOY.md"), "utf8");
    expect(deploy).toContain("INSTAGRAM_APP_ID");
    expect(deploy).toContain("OAuth redirect URIs");
    expect(deploy).toContain("https://api.duskly.site/v1/instagram/webhook");
    expect(deploy).toContain("INSTAGRAM_WEBHOOK_VERIFY_TOKEN");
  });

  it("docs, privacy, and accounts explain Slack chat:write.public", () => {
    const docs = readFileSync(join(here, "../../../web/src/app/docs/docs-overview.page.ts"), "utf8");
    const privacy = readFileSync(join(here, "../../../web/src/app/pages/legal.page.ts"), "utf8");
    const accounts = readFileSync(join(here, "../../../web/src/app/accounts/accounts.page.ts"), "utf8");
    for (const src of [docs, privacy, accounts]) {
      expect(src).toContain("chat:write.public");
      expect(src).toMatch(/before the bot is invited/i);
    }
    expect(docs).toContain("https://www.googleapis.com/auth/youtube.upload");
    expect(docs).not.toMatch(/Medium/i);
    expect(accounts).not.toMatch(/Medium/i);
    expect(docs).toContain("https://api.duskly.site/v1/media/:id/public?exp");
    expect(docs).toContain("https://api.duskly.site/v1/meta/data-deletion");
    expect(docs).toContain("https://duskly.site/data-deletion");
    expect(privacy).toContain("https://api.duskly.site/v1/media/:id/public?exp");
    expect(privacy).toContain("https://api.duskly.site/v1/meta/data-deletion");
    expect(privacy).toContain("https://duskly.site/data-deletion");
  });
});

const FB_STATE = "11111111-1111-1111-1111-111111111111";

function fbStored(network: "facebook" | "instagram" = "facebook") {
  return JSON.stringify({
    workspaceId: "ws1",
    userId: "u1",
    network,
    verifier: "verifier",
    instance: "https://mastodon.social",
    redirectUri: `https://api.duskly.site/v1/accounts/oauth/${network}/callback`,
  });
}

function graphRes(ok: boolean, body: unknown) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return {
    ok,
    json: async () => (typeof body === "string" ? JSON.parse(body) : body),
    text: async () => text,
  };
}

function fetchUrlAndBody(url: unknown, init?: { body?: URLSearchParams | string }): { url: string; body: string } {
  return { url: String(url), body: init?.body != null ? String(init.body) : "" };
}

function isCodeExchange(url: string, body: string) {
  return url.includes("/oauth/access_token") && !url.includes("fb_exchange_token") && !body.includes("fb_exchange_token");
}

function isLongLived(url: string, body: string) {
  return url.includes("fb_exchange_token") || body.includes("fb_exchange_token");
}

function mockD1() {
  const stmt = {
    bind: (..._args: unknown[]) => stmt,
    all: async () => ({ results: [], success: true }),
    first: async () => null,
    run: async () => ({ success: true, meta: { changes: 1 } }),
    raw: async () => [],
  };
  return {
    prepare: (_sql: string) => stmt,
    batch: async (stmts: unknown[]) => stmts,
  };
}

function memoryKv(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    get: async (k: string) => store.get(k) ?? null,
    put: async (k: string, v: string) => {
      store.set(k, v);
    },
    delete: async (k: string) => {
      store.delete(k);
    },
  };
}

function callbackEnv(overrides: Record<string, unknown> = {}) {
  return {
    WEB_ORIGIN: "https://duskly.site",
    BETTER_AUTH_URL: "https://api.duskly.site",
    META_APP_ID: "meta-id",
    META_APP_SECRET: "meta-secret",
    TOKEN_ENCRYPTION_KEY: "a".repeat(64),
    KV: memoryKv({ [`oauth:${FB_STATE}`]: fbStored() }),
    ...overrides,
  } as unknown as Env;
}

async function facebookCallback(env: Env, search = `code=test-code&state=${FB_STATE}`) {
  return worker.fetch(
    new Request(`https://api.duskly.site/v1/accounts/oauth/facebook/callback?${search}`),
    env,
    {} as ExecutionContext,
  );
}

function expectAppRedirect(res: Response, oauth: string) {
  expect(res.status).toBeGreaterThanOrEqual(300);
  expect(res.status).toBeLessThan(400);
  expect(res.status).not.toBe(500);
  const loc = res.headers.get("location") || "";
  expect(loc.startsWith("https://duskly.site/app/accounts?")).toBe(true);
  expect(loc).toContain(`oauth=${oauth}`);
}

describe("Facebook token payload helpers", () => {
  it("reads JSON access_token and classifies Graph errors without leaking secrets", () => {
    expect(parseFacebookTokenPayload(JSON.stringify({ access_token: "short", token_type: "bearer" })).access_token).toBe(
      "short",
    );
    expect(parseFacebookTokenPayload("access_token=short-token&token_type=bearer&expires_in=3600").access_token).toBe(
      "short-token",
    );
    const formErr = parseFacebookTokenPayload(
      "error=OAuthException&error_code=100&error_message=redirect_uri+mismatch",
    );
    expect(graphOauthReason(formErr)).toBe("redirect_uri");
    expect(graphOauthReason({ error: { message: "redirect_uri mismatch", type: "OAuthException", code: 100 } })).toBe(
      "redirect_uri",
    );
    expect(graphOauthReason({ error: { message: "Error validating application secret", code: 1 } })).toBe("bad_secret");
    expect(graphOauthReason({ error: { message: "This authorization code has been used." } })).toBe("code_used");
    expect(graphOauthReason({ error: { message: "The Instagram account is not a professional account" } })).toBe(
      "not_professional",
    );
    expect(safeOauthReason("EAABsbCS0123456789 leaked")).toBe("");
    expect(safeOauthReason("access_denied")).toBe("access_denied");
    expect(safeOauthDetail("Requires pages_show_list")).toBe("Requires pages_show_list");
    expect(safeOauthDetail("token EAABsbCS0123456789")).toBe("token");
  });
});

describe("Facebook OAuth callback", () => {
  it("redirects oauth=error when Facebook sends error= (not 500)", async () => {
    const res = await facebookCallback(callbackEnv(), `error=access_denied&state=${FB_STATE}`);
    expectAppRedirect(res, "error");
    expect(res.headers.get("location") || "").toContain("reason=access_denied");
    expect(res.headers.get("location") || "").toContain("network=facebook");
  });

  it("redirects oauth=expired when state is missing from KV", async () => {
    const res = await facebookCallback(callbackEnv({ KV: memoryKv() }));
    expectAppRedirect(res, "expired");
    expect(res.headers.get("location") || "").toContain("network=facebook");
  });

  it("redirects oauth=error when KV throws instead of 500", async () => {
    const res = await facebookCallback(
      callbackEnv({
        KV: {
          get: async () => {
            throw new Error("kv down");
          },
          delete: async () => undefined,
        },
      }),
    );
    expectAppRedirect(res, "error");
    expect(res.headers.get("location") || "").toContain("reason=kv");
    expect(res.headers.get("location") || "").toContain("network=facebook");
  });

  it("redirects oauth=error when stored state is not JSON", async () => {
    const res = await facebookCallback(
      callbackEnv({ KV: memoryKv({ [`oauth:${FB_STATE}`]: "not-json" }) }),
    );
    expectAppRedirect(res, "error");
    expect(res.headers.get("location") || "").toContain("reason=bad_state");
    expect(res.headers.get("location") || "").toContain("network=facebook");
  });

  it("redirects oauth=token_failed when Graph returns an OAuthException (not 500)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(graphRes(false, { error: { message: "redirect_uri mismatch", type: "OAuthException" } })),
    );
    const res = await facebookCallback(callbackEnv());
    expectAppRedirect(res, "token_failed");
    const loc = res.headers.get("location") || "";
    expect(loc).toContain("reason=redirect_uri");
    expect(loc).toContain("network=facebook");
    expect(loc).toContain("detail=redirect_uri");
  });

  it("redirects oauth=token_failed when Graph returns HTTP 200 with an error object", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        graphRes(true, { error: { message: "Invalid verification code format", type: "OAuthException" } }),
      ),
    );
    const res = await facebookCallback(callbackEnv());
    expectAppRedirect(res, "token_failed");
    expect(res.headers.get("location") || "").toContain("reason=bad_code");
    expect(res.headers.get("location") || "").toContain("network=facebook");
  });

  it("redirects oauth=token_failed when Graph fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const res = await facebookCallback(callbackEnv());
    expectAppRedirect(res, "token_failed");
    expect(res.headers.get("location") || "").toContain("reason=exchange");
    expect(res.headers.get("location") || "").toContain("network=facebook");
  });

  it("redirects oauth=token_failed when META_APP_SECRET is missing", async () => {
    const res = await facebookCallback(callbackEnv({ META_APP_SECRET: "  " }));
    expectAppRedirect(res, "token_failed");
    expect(res.headers.get("location") || "").toContain("reason=missing_secret");
    expect(res.headers.get("location") || "").toContain("network=facebook");
  });

  it("POSTs the stored redirect_uri and secret even if BETTER_AUTH_URL has a trailing slash", async () => {
    const fetch = vi.fn().mockResolvedValue(
      graphRes(false, { error: { type: "OAuthException", message: "redirect_uri mismatch" } }),
    );
    vi.stubGlobal("fetch", fetch);
    const res = await facebookCallback(callbackEnv({ BETTER_AUTH_URL: "https://api.duskly.site/" }));
    expectAppRedirect(res, "token_failed");
    expect(fetch).toHaveBeenCalled();
    const called = String(fetch.mock.calls[0][0]);
    expect(called).toBe("https://graph.facebook.com/v21.0/oauth/access_token");
    const init = fetch.mock.calls[0][1] as { method?: string; body?: URLSearchParams };
    expect(init.method).toBe("POST");
    const q = new URLSearchParams(String(init.body));
    expect(q.get("redirect_uri")).toBe("https://api.duskly.site/v1/accounts/oauth/facebook/callback");
    expect(q.get("client_id")).toBe("meta-id");
    expect(q.get("client_secret")).toBe("meta-secret");
    expect(q.get("code")).toBe("test-code");
  });

  it("reuses the authorize redirect_uri stored on state even if BETTER_AUTH_URL changed", async () => {
    const fetch = vi.fn().mockResolvedValue(
      graphRes(false, { error: { type: "OAuthException", message: "redirect_uri mismatch" } }),
    );
    vi.stubGlobal("fetch", fetch);
    const res = await facebookCallback(
      callbackEnv({
        BETTER_AUTH_URL: "https://other.example/",
        KV: memoryKv({
          [`oauth:${FB_STATE}`]: JSON.stringify({
            workspaceId: "ws1",
            userId: "u1",
            network: "facebook",
            verifier: "verifier",
            instance: "https://mastodon.social",
            redirectUri: "https://api.duskly.site/v1/accounts/oauth/facebook/callback",
          }),
        }),
      }),
    );
    expectAppRedirect(res, "token_failed");
    const init = fetch.mock.calls[0][1] as { body?: URLSearchParams };
    expect(new URLSearchParams(String(init.body)).get("redirect_uri")).toBe(
      "https://api.duskly.site/v1/accounts/oauth/facebook/callback",
    );
  });

  it("accepts a form-encoded short-lived token and does not treat it as credential rejection", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: { body?: URLSearchParams | string }) => {
        const { url: u, body } = fetchUrlAndBody(url, init);
        if (isCodeExchange(u, body)) {
          return graphRes(true, "access_token=short-token&token_type=bearer&expires_in=3600");
        }
        if (isLongLived(u, body)) return graphRes(true, { access_token: "long-token" });
        if (u.includes("/me/accounts")) return graphRes(true, { data: [] });
        return graphRes(true, { id: "99" });
      }),
    );
    const res = await facebookCallback(callbackEnv());
    expectAppRedirect(res, "no_page");
    expect(res.headers.get("location") || "").toContain("reason=no_page");
    expect(res.headers.get("location") || "").toContain("network=facebook");
  });

  it("labels a Pages Graph failure as pages/graph, not credential rejection or empty Pages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: { body?: URLSearchParams | string }) => {
        const { url: u, body } = fetchUrlAndBody(url, init);
        if (isCodeExchange(u, body)) return graphRes(true, { access_token: "short-token" });
        if (isLongLived(u, body)) return graphRes(true, { access_token: "long-token" });
        if (u.includes("/me/accounts")) {
          return graphRes(false, { error: { message: "Requires pages_show_list", code: 200 } });
        }
        return graphRes(true, { id: "99" });
      }),
    );
    const res = await facebookCallback(callbackEnv());
    expectAppRedirect(res, "error");
    const loc = res.headers.get("location") || "";
    expect(loc).toContain("reason=graph_200");
    expect(loc).toContain("detail=Requires");
    expect(loc).toContain("network=facebook");
    expect(loc).not.toContain("oauth=token_failed");
    expect(loc).not.toContain("oauth=no_page");
  });

  it("redirects oauth=error reason=encrypt detail=missing when TOKEN_ENCRYPTION_KEY is empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: { body?: URLSearchParams | string }) => {
        const { url: u, body } = fetchUrlAndBody(url, init);
        if (isCodeExchange(u, body)) return graphRes(true, { access_token: "short-token" });
        if (isLongLived(u, body)) return graphRes(true, { access_token: "long-token" });
        if (u.includes("/me?") && u.includes("fields=id")) return graphRes(true, { id: "99" });
        if (u.includes("/me/accounts")) {
          return graphRes(true, { data: [{ id: "p1", name: "Page", access_token: "page-token" }] });
        }
        return graphRes(false, {});
      }),
    );
    const res = await facebookCallback(callbackEnv({ TOKEN_ENCRYPTION_KEY: "" }));
    expectAppRedirect(res, "error");
    const loc = res.headers.get("location") || "";
    expect(loc).toContain("reason=encrypt");
    expect(loc).toContain("detail=missing");
    expect(loc).toContain("network=facebook");
  });

  it("redirects oauth=error reason=encrypt with a crypto name when encrypt throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: { body?: URLSearchParams | string }) => {
        const { url: u, body } = fetchUrlAndBody(url, init);
        if (isCodeExchange(u, body)) return graphRes(true, { access_token: "short-token" });
        if (isLongLived(u, body)) return graphRes(true, { access_token: "long-token" });
        if (u.includes("/me?") && u.includes("fields=id")) return graphRes(true, { id: "99" });
        if (u.includes("/me/accounts")) {
          return graphRes(true, { data: [{ id: "p1", name: "Page", access_token: "page-token" }] });
        }
        return graphRes(false, {});
      }),
    );
    const encryptSpy = vi.spyOn(crypto.subtle, "encrypt").mockRejectedValueOnce(new DOMException("boom", "OperationError"));
    const res = await facebookCallback(callbackEnv({ DB: mockD1() }));
    encryptSpy.mockRestore();
    expectAppRedirect(res, "error");
    const loc = res.headers.get("location") || "";
    expect(loc).toContain("reason=encrypt");
    expect(loc).toContain("detail=OperationError");
    expect(loc).not.toContain("detail=missing");
    expect(loc).toContain("network=facebook");
  });

  it("connects a Page when TOKEN_ENCRYPTION_KEY is a passphrase rather than 64-hex", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: { body?: URLSearchParams | string }) => {
        const { url: u, body } = fetchUrlAndBody(url, init);
        if (isCodeExchange(u, body)) return graphRes(true, { access_token: "short-token" });
        if (isLongLived(u, body)) return graphRes(true, { access_token: "long-token" });
        if (u.includes("/me?") && u.includes("fields=id")) return graphRes(true, { id: "99" });
        if (u.includes("/me/accounts")) {
          return graphRes(true, { data: [{ id: "p1", name: "Page", access_token: "page-token" }] });
        }
        return graphRes(false, {});
      }),
    );
    const res = await facebookCallback(callbackEnv({ TOKEN_ENCRYPTION_KEY: "not-a-32-byte-key", DB: mockD1() }));
    expectAppRedirect(res, "ok");
    expect(res.headers.get("location") || "").toContain("network=facebook");
  });

  it("connects a single Page after user token, long-lived token, and /me/accounts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: { body?: URLSearchParams | string }) => {
        const { url: u, body } = fetchUrlAndBody(url, init);
        if (isCodeExchange(u, body)) return graphRes(true, { access_token: "short-token" });
        if (isLongLived(u, body)) return graphRes(true, { access_token: "long-token" });
        if (u.includes("/me?") && u.includes("fields=id")) return graphRes(true, { id: "99" });
        if (u.includes("/me/accounts")) {
          return graphRes(true, { data: [{ id: "p1", name: "Page", access_token: "page-token" }] });
        }
        return graphRes(false, {});
      }),
    );
    const res = await facebookCallback(callbackEnv({ DB: mockD1() }));
    expectAppRedirect(res, "ok");
    expect(res.headers.get("location") || "").toContain("network=facebook");
  });

  it("ignores Facebook's #_=_ fragment and still returns a redirect with an empty hash", async () => {
    const res = await worker.fetch(
      new Request(
        `https://api.duskly.site/v1/accounts/oauth/facebook/callback?code=test-code&state=${FB_STATE}#_=_`,
      ),
      callbackEnv({ KV: memoryKv() }),
      {} as ExecutionContext,
    );
    expectAppRedirect(res, "expired");
    expect(res.headers.get("location") || "").toMatch(/#$/);
    expect(res.headers.get("location") || "").toContain("network=facebook");
  });
});

describe("Instagram account labels", () => {
  it("labels the Instagram username or IG id, never the Facebook Page name", () => {
    expect(instagramAccountLabel({ igUsername: "dusklycafe", igUserId: "1784" })).toBe("@dusklycafe");
    expect(instagramAccountLabel({ igUsername: "@dusklycafe" })).toBe("@dusklycafe");
    expect(instagramAccountLabel({ igUserId: "1784" })).toBe("1784");
    expect(instagramAccountLabel({})).toBe("");
    expect(
      facebookConnectHandle("instagram", [
        { id: "p1", name: "Cafe Page", accessToken: "t", igUserId: "1784", igUsername: "dusklycafe" },
      ]),
    ).toBe("@dusklycafe");
    expect(
      facebookConnectHandle("facebook", [{ id: "p1", name: "Cafe Page", accessToken: "t" }]),
    ).toBe("Cafe Page");
    expect(
      facebookConnectHandle("instagram", [
        { id: "p1", name: "Cafe", accessToken: "t", igUserId: "1", igUsername: "one" },
        { id: "p2", name: "Shop", accessToken: "t", igUserId: "2", igUsername: "two" },
      ]),
    ).toBe("instagram · pick an account");
    expect(
      facebookConnectHandle("facebook", [
        { id: "p1", name: "Cafe", accessToken: "t" },
        { id: "p2", name: "Shop", accessToken: "t" },
      ]),
    ).toBe("facebook · pick a Page");
  });

  it("lists only Pages with a linked Instagram professional account when requireIg", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.includes("/me/accounts")) {
          expect(u).toContain("instagram_business_account");
          expect(u).toContain("username");
          return graphRes(true, {
            data: [
              { id: "p1", name: "Cafe Page", access_token: "page-1", instagram_business_account: { id: "1784", username: "dusklycafe" } },
              { id: "p2", name: "Bare Page", access_token: "page-2" },
            ],
          });
        }
        return graphRes(false, {});
      }),
    );
    const listed = await listFacebookPages("user-token", true);
    expect(listed.error).toBeUndefined();
    expect(listed.pages).toEqual([
      { id: "p1", name: "Cafe Page", accessToken: "page-1", igUserId: "1784", igUsername: "dusklycafe" },
    ]);
  });

  it("fetches the Instagram username when /me/accounts only returns the IG id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.includes("/me/accounts")) {
          return graphRes(true, {
            data: [{ id: "p1", name: "Cafe Page", access_token: "page-1", instagram_business_account: { id: "1784" } }],
          });
        }
        if (u.includes("/1784") && u.includes("username")) {
          return graphRes(true, { username: "dusklycafe" });
        }
        return graphRes(false, {});
      }),
    );
    const listed = await listFacebookPages("user-token", true);
    expect(listed.pages[0]?.igUsername).toBe("dusklycafe");
    expect(instagramAccountLabel(listed.pages[0]!)).toBe("@dusklycafe");
  });

  it("reads the linked Instagram username from a connected Facebook Page", async () => {
    const fetch = vi.fn(async (url: string) => {
      expect(String(url)).toContain("graph.facebook.com/v21.0/page-1");
      return graphRes(true, {
        name: "Test duskly",
        instagram_business_account: { id: "28317672417889630", username: "dusklycafe" },
      });
    });
    vi.stubGlobal("fetch", fetch);
    await expect(fetchFacebookPageInstagramAccount("page-token", "page-1")).resolves.toEqual({
      pageName: "Test duskly",
      igUserId: "28317672417889630",
      igUsername: "dusklycafe",
    });
  });
});

async function instagramCallback(env: Env, search = `code=test-code&state=${FB_STATE}`) {
  return worker.fetch(
    new Request(`https://api.duskly.site/v1/accounts/oauth/instagram/callback?${search}`),
    env,
    {} as ExecutionContext,
  );
}

function instagramCallbackEnv(overrides: Record<string, unknown> = {}) {
  return callbackEnv({
    KV: memoryKv({ [`oauth:${FB_STATE}`]: fbStored("instagram") }),
    ...overrides,
  });
}

describe("Instagram OAuth callback", () => {
  it("redirects no_page when Pages exist but none have a linked Instagram professional account", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: { body?: URLSearchParams | string }) => {
        const { url: u, body } = fetchUrlAndBody(url, init);
        if (isCodeExchange(u, body)) return graphRes(true, { access_token: "short-token" });
        if (isLongLived(u, body)) return graphRes(true, { access_token: "long-token" });
        if (u.includes("/me?") && u.includes("fields=id")) return graphRes(true, { id: "99" });
        if (u.includes("/me/accounts")) {
          return graphRes(true, { data: [{ id: "p1", name: "Cafe Page", access_token: "page-token" }] });
        }
        return graphRes(false, {});
      }),
    );
    const res = await instagramCallback(instagramCallbackEnv());
    expectAppRedirect(res, "no_page");
    expect(res.headers.get("location") || "").toContain("reason=no_page");
    expect(res.headers.get("location") || "").toContain("network=instagram");
  });

  it("connects a single Instagram account without asking the user to pick a Page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: { body?: URLSearchParams | string }) => {
        const { url: u, body } = fetchUrlAndBody(url, init);
        if (isCodeExchange(u, body)) return graphRes(true, { access_token: "short-token" });
        if (isLongLived(u, body)) return graphRes(true, { access_token: "long-token" });
        if (u.includes("/me?") && u.includes("fields=id")) return graphRes(true, { id: "99" });
        if (u.includes("/me/accounts")) {
          return graphRes(true, {
            data: [
              { id: "p1", name: "Cafe Page", access_token: "page-token", instagram_business_account: { id: "1784", username: "dusklycafe" } },
              { id: "p2", name: "Bare Page", access_token: "other-token" },
            ],
          });
        }
        return graphRes(false, {});
      }),
    );
    const res = await instagramCallback(instagramCallbackEnv({ DB: mockD1() }));
    expectAppRedirect(res, "ok");
    const loc = res.headers.get("location") || "";
    expect(loc).toContain("network=instagram");
    expect(loc).not.toContain("accountId=");
  });

  it("asks the user to pick among Instagram usernames when several Pages have IG accounts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: { body?: URLSearchParams | string }) => {
        const { url: u, body } = fetchUrlAndBody(url, init);
        if (isCodeExchange(u, body)) return graphRes(true, { access_token: "short-token" });
        if (isLongLived(u, body)) return graphRes(true, { access_token: "long-token" });
        if (u.includes("/me?") && u.includes("fields=id")) return graphRes(true, { id: "99" });
        if (u.includes("/me/accounts")) {
          return graphRes(true, {
            data: [
              { id: "p1", name: "Cafe Page", access_token: "page-1", instagram_business_account: { id: "1784", username: "dusklycafe" } },
              { id: "p2", name: "Shop Page", access_token: "page-2", instagram_business_account: { id: "1785", username: "dusklyshop" } },
            ],
          });
        }
        return graphRes(false, {});
      }),
    );
    const res = await instagramCallback(instagramCallbackEnv({ DB: mockD1() }));
    expectAppRedirect(res, "ok");
    const loc = res.headers.get("location") || "";
    expect(loc).toContain("network=instagram");
    expect(loc).toContain("accountId=");
  });
});

function instagramLoginEnv(overrides: Record<string, unknown> = {}) {
  return instagramCallbackEnv({
    INSTAGRAM_APP_ID: "ig-app-id",
    INSTAGRAM_APP_SECRET: "ig-app-secret",
    ...overrides,
  });
}

function isInstagramCodeExchange(url: string) {
  return url.includes("https://api.instagram.com/oauth/access_token");
}

function isInstagramLongLived(url: string, body = "") {
  return (
    /https:\/\/graph\.instagram\.com(?:\/v[\d.]+)?\/access_token/.test(url) &&
    (url.includes("ig_exchange_token") || body.includes("ig_exchange_token"))
  );
}

function isFacebookOauthAccessToken(url: string) {
  return /graph\.facebook\.com\/[^/]*\/oauth\/access_token/.test(url) || url.includes("graph.facebook.com/oauth/access_token");
}

function isInstagramLoginMe(url: string) {
  return url.includes("https://graph.instagram.com/v25.0/me") && url.includes("user_id");
}

describe("Instagram Login OAuth callback", () => {
  it("POSTs client_id, secret, grant_type, redirect_uri, and code to api.instagram.com", async () => {
    const fetch = vi.fn().mockResolvedValue(
      graphRes(false, { error: { message: "redirect_uri mismatch", type: "OAuthException" } }),
    );
    vi.stubGlobal("fetch", fetch);
    const res = await instagramCallback(instagramLoginEnv());
    expectAppRedirect(res, "token_failed");
    expect(String(fetch.mock.calls[0][0])).toBe("https://api.instagram.com/oauth/access_token");
    const init = fetch.mock.calls[0][1] as { method?: string; body?: URLSearchParams };
    expect(init.method).toBe("POST");
    const q = new URLSearchParams(String(init.body));
    expect(q.get("client_id")).toBe("ig-app-id");
    expect(q.get("client_secret")).toBe("ig-app-secret");
    expect(q.get("grant_type")).toBe("authorization_code");
    expect(q.get("redirect_uri")).toBe("https://api.duskly.site/v1/accounts/oauth/instagram/callback");
    expect(q.get("code")).toBe("test-code");
    expect(res.headers.get("location") || "").toContain("reason=redirect_uri");
    expect(fetch.mock.calls.some(([u]) => isFacebookOauthAccessToken(String(u)))).toBe(false);
  });

  it("connects a professional account without a Facebook Page after long-lived token and /me", async () => {
    const KV = memoryKv({ [`oauth:${FB_STATE}`]: fbStored("instagram") });
    const fetch = vi.fn(async (url: string, init?: { method?: string; body?: URLSearchParams | string }) => {
      const u = String(url);
      const body = init?.body != null ? String(init.body) : "";
      if (isInstagramCodeExchange(u)) return graphRes(true, { access_token: "ig-short", user_id: "1784" });
      if (isInstagramLongLived(u, body)) return graphRes(true, { access_token: "ig-long", expires_in: 5184000 });
      if (isInstagramLoginMe(u)) return graphRes(true, { id: "app-scoped-id", user_id: "9999", username: "dusklycafe" });
      return graphRes(false, { url: u, body });
    });
    vi.stubGlobal("fetch", fetch);
    const res = await instagramCallback(instagramLoginEnv({ DB: mockD1(), KV }));
    expectAppRedirect(res, "ok");
    const loc = res.headers.get("location") || "";
    expect(loc).toContain("network=instagram");
    expect(loc).not.toContain("accountId=");
    expect(fetch.mock.calls.some(([u]) => String(u).includes("/me/accounts"))).toBe(false);
    expect(fetch.mock.calls.some(([u]) => String(u).includes("graph.facebook.com"))).toBe(false);
    const longLived = fetch.mock.calls.find(([u, init]) =>
      isInstagramLongLived(String(u), init?.body != null ? String(init.body) : ""),
    );
    expect(longLived).toBeTruthy();
    const longUrl = new URL(String(longLived![0]));
    expect(`${longUrl.origin}${longUrl.pathname}`).toBe("https://graph.instagram.com/access_token");
    expect((longLived![1] as { method?: string } | undefined)?.method || "GET").toBe("GET");
    expect((longLived![1] as { body?: unknown } | undefined)?.body).toBeUndefined();
    expect(longUrl.searchParams.get("grant_type")).toBe("ig_exchange_token");
    expect(longUrl.searchParams.get("client_secret")).toBe("ig-app-secret");
    expect(longUrl.searchParams.get("access_token")).toBe("ig-short");
    expect(await KV.get("meta-user:1784")).toBe("ws1");
    expect(await KV.get("meta-user:9999")).toBeNull();
    const meCall = fetch.mock.calls.find(([u]) => isInstagramLoginMe(String(u)));
    expect(meCall).toBeTruthy();
    expect(String(meCall![0])).toContain("access_token=ig-long");
    expect(
      fetch.mock.calls.some(
        ([u, init]) => isFacebookOauthAccessToken(String(u)) && (init?.method || "GET").toUpperCase() === "GET",
      ),
    ).toBe(false);
  });

  it("accepts the Instagram data[] token payload shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: { body?: URLSearchParams | string }) => {
        const u = String(url);
        const body = init?.body != null ? String(init.body) : "";
        if (isInstagramCodeExchange(u)) {
          return graphRes(true, { data: [{ access_token: "ig-short", user_id: "1784" }] });
        }
        if (isInstagramLongLived(u, body)) return graphRes(true, { access_token: "ig-long" });
        if (isInstagramLoginMe(u)) return graphRes(true, { user_id: "1784", username: "dusklycafe" });
        return graphRes(false, {});
      }),
    );
    const res = await instagramCallback(instagramLoginEnv({ DB: mockD1() }));
    expectAppRedirect(res, "ok");
  });

  it("surfaces not_professional when Meta rejects a personal account", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: { body?: URLSearchParams | string }) => {
        const u = String(url);
        const body = init?.body != null ? String(init.body) : "";
        if (isInstagramCodeExchange(u)) return graphRes(true, { access_token: "ig-short" });
        if (isInstagramLongLived(u, body)) return graphRes(true, { access_token: "ig-long" });
        if (isInstagramLoginMe(u)) {
          return graphRes(false, {
            error: { message: "The Instagram account is not a professional account", type: "OAuthException" },
          });
        }
        return graphRes(false, {});
      }),
    );
    const res = await instagramCallback(instagramLoginEnv());
    expectAppRedirect(res, "error");
    const loc = res.headers.get("location") || "";
    expect(loc).toContain("reason=not_professional");
    expect(loc).toContain("network=instagram");
  });

  it("skips ig_exchange_token when the code exchange already returned a long-lived expires_in", async () => {
    const fetch = vi.fn(async (url: string) => {
      const u = String(url);
      if (isInstagramCodeExchange(u)) {
        return graphRes(true, {
          data: [{ access_token: "ig-already-long", user_id: "1784", expires_in: 5184000 }],
        });
      }
      if (isInstagramLoginMe(u)) return graphRes(true, { user_id: "1784", username: "dusklycafe" });
      return graphRes(false, { url: u });
    });
    vi.stubGlobal("fetch", fetch);
    const res = await instagramCallback(instagramLoginEnv({ DB: mockD1() }));
    expectAppRedirect(res, "ok");
    expect(fetch.mock.calls.some(([u, init]) => isInstagramLongLived(String(u), init?.body != null ? String(init.body) : ""))).toBe(
      false,
    );
    expect(fetch.mock.calls.some(([u]) => String(u).includes("graph.facebook.com"))).toBe(false);
    expect(fetch.mock.calls.some(([u]) => isInstagramLoginMe(String(u)))).toBe(true);
  });

  it("keeps the code-exchange token and saves the account when GET /access_token returns Graph 100 method type", async () => {
    const fetch = vi.fn(
      async (url: string, init?: { method?: string; body?: URLSearchParams | string; headers?: { authorization?: string } }) => {
        const u = String(url);
        const body = init?.body != null ? String(init.body) : "";
        if (isInstagramCodeExchange(u)) return graphRes(true, { access_token: "ig-short", user_id: "1784" });
        if (isInstagramLongLived(u, body)) {
          return graphRes(false, {
            error: { message: "Unsupported request - method type: get", type: "IGApiException", code: 100 },
          });
        }
        if (isInstagramLoginMe(u)) {
          expect(u).toContain("access_token=ig-short");
          return graphRes(true, { user_id: "1784", username: "dusklycafe" });
        }
        return graphRes(false, {});
      },
    );
    vi.stubGlobal("fetch", fetch);
    const res = await instagramCallback(instagramLoginEnv({ DB: mockD1() }));
    expectAppRedirect(res, "ok");
    const loc = res.headers.get("location") || "";
    expect(loc).not.toContain("oauth=token_failed");
    expect(loc).not.toContain("reason=graph_100");
    expect(loc).toContain("network=instagram");
    expect(fetch.mock.calls.some(([u]) => isFacebookOauthAccessToken(String(u)))).toBe(false);
    const longLived = fetch.mock.calls.find(([u, init]) =>
      isInstagramLongLived(String(u), init?.body != null ? String(init.body) : ""),
    );
    expect(longLived).toBeTruthy();
    expect((longLived?.[1] as { method?: string } | undefined)?.method || "GET").toBe("GET");
    expect(`${new URL(String(longLived?.[0])).origin}${new URL(String(longLived?.[0])).pathname}`).toBe(
      "https://graph.instagram.com/access_token",
    );
    expect(String(longLived?.[0])).toContain("grant_type=ig_exchange_token");
    expect((longLived?.[1] as { body?: unknown } | undefined)?.body).toBeUndefined();
    expect(fetch.mock.calls.some(([u]) => isInstagramLoginMe(String(u)))).toBe(true);
  });

  it("saves the account from the code-exchange user_id when /me returns Graph 100 method type", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: { body?: URLSearchParams | string }) => {
        const u = String(url);
        const body = init?.body != null ? String(init.body) : "";
        if (isInstagramCodeExchange(u)) {
          return graphRes(true, { data: [{ access_token: "ig-short", user_id: "1784" }] });
        }
        if (isInstagramLongLived(u, body)) return graphRes(true, { access_token: "ig-long", expires_in: 5184000 });
        if (isInstagramLoginMe(u)) {
          return graphRes(false, {
            error: { message: "Unsupported request - method type: get", type: "IGApiException", code: 100 },
          });
        }
        return graphRes(false, {});
      }),
    );
    const res = await instagramCallback(instagramLoginEnv({ DB: mockD1() }));
    expectAppRedirect(res, "ok");
    expect(res.headers.get("location") || "").not.toContain("reason=graph_100");
  });

  it("still fails Instagram Login when long-lived exchange returns a real Graph error", async () => {
    const fetch = vi.fn(async (url: string, init?: { method?: string; body?: URLSearchParams | string }) => {
      const u = String(url);
      const body = init?.body != null ? String(init.body) : "";
      if (isInstagramCodeExchange(u)) return graphRes(true, { access_token: "ig-short" });
      if (isInstagramLongLived(u, body)) {
        return graphRes(false, {
          error: { message: "Invalid Instagram app secret", type: "OAuthException", code: 190 },
        });
      }
      return graphRes(false, {});
    });
    vi.stubGlobal("fetch", fetch);
    const res = await instagramCallback(instagramLoginEnv());
    expectAppRedirect(res, "token_failed");
    expect(res.headers.get("location") || "").toContain("reason=bad_secret");
  });

  it("falls back to Facebook Login + Pages when INSTAGRAM_APP_SECRET is unset", async () => {
    const fetch = vi.fn(async (url: string, init?: { method?: string; body?: URLSearchParams | string }) => {
      const { url: u, body } = fetchUrlAndBody(url, init);
      expect(u).not.toContain("api.instagram.com");
      expect(u).not.toContain("graph.instagram.com");
      if (isCodeExchange(u, body)) return graphRes(true, { access_token: "short-token" });
      if (isLongLived(u, body)) return graphRes(true, { access_token: "long-token" });
      if (u.includes("/me?") && u.includes("fields=id")) return graphRes(true, { id: "99" });
      if (u.includes("/me/accounts")) {
        return graphRes(true, {
          data: [
            { id: "p1", name: "Cafe Page", access_token: "page-token", instagram_business_account: { id: "1784", username: "dusklycafe" } },
          ],
        });
      }
      return graphRes(false, {});
    });
    vi.stubGlobal("fetch", fetch);
    const res = await instagramCallback(instagramLoginEnv({ INSTAGRAM_APP_SECRET: "", DB: mockD1() }));
    expectAppRedirect(res, "ok");
    expect(res.headers.get("location") || "").toContain("network=instagram");
    const tokenCall = fetch.mock.calls.find(([u]) => isFacebookOauthAccessToken(String(u)));
    expect(tokenCall).toBeTruthy();
    expect(String(tokenCall![0])).toBe("https://graph.facebook.com/v21.0/oauth/access_token");
    expect((tokenCall![1] as { method?: string }).method).toBe("POST");
    expect(String(tokenCall![0])).not.toContain("?");
  });

  it("credentials persisted from Instagram Login record authKind instagram_login", () => {
    expect(INSTAGRAM_LOGIN_AUTH).toBe("instagram_login");
    const src = readFileSync(join(here, "../routes/oauth.ts"), "utf8");
    expect(src).toContain("authKind: INSTAGRAM_LOGIN_AUTH");
    expect(src).toContain("exchangeInstagramUserToken");
    expect(src).toContain("instagramLoginConfigured");
    expect(src).toContain("instagramLogin: network === \"instagram\" && instagramLoginConfigured(c.env)");
    const providers = readFileSync(join(here, "../lib/oauth-providers.ts"), "utf8");
    expect(providers).toContain('fetch("https://api.instagram.com/oauth/access_token"');
    expect(providers).toContain('INSTAGRAM_GRAPH_VERSION = "v25.0"');
    expect(providers).toContain("https://graph.instagram.com/access_token?");
    expect(providers).toContain('grant_type: "ig_exchange_token"');
    expect(providers).toMatch(/INSTAGRAM_GRAPH_BASE\}\/me\?/);
    expect(providers).not.toMatch(/graph\.instagram\.com\/v21\.0/);
    expect(providers).toContain('fetch("https://graph.facebook.com/v21.0/oauth/access_token"');
    expect(providers).not.toMatch(
      /fetch\(\s*`https:\/\/graph\.facebook\.com\/[^`]*oauth\/access_token\?/,
    );
  });
});
