import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "../index";
import type { Env } from "../env";
import { buildAuthorizeUrl, normalizeSubreddit, oauthConfigured } from "../lib/oauth-providers";
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
    expect(q.get("scope")).toBe("tweet.read tweet.write users.read offline.access");
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
    const url = buildAuthorizeUrl({ ...base, network: "facebook" });
    expect(new URL(url).searchParams.get("scope")).toBe(
      "pages_manage_posts,pages_read_engagement,pages_show_list",
    );
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
  });
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

describe("Facebook OAuth callback", () => {
  it("redirects oauth=error when Facebook sends error= (not 500)", async () => {
    const res = await facebookCallback(callbackEnv(), `error=access_denied&state=${FB_STATE}`);
    expectAppRedirect(res, "error");
  });

  it("redirects oauth=expired when state is missing from KV", async () => {
    const res = await facebookCallback(callbackEnv({ KV: memoryKv() }));
    expectAppRedirect(res, "expired");
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
  });

  it("redirects oauth=error when stored state is not JSON", async () => {
    const res = await facebookCallback(
      callbackEnv({ KV: memoryKv({ [`oauth:${FB_STATE}`]: "not-json" }) }),
    );
    expectAppRedirect(res, "error");
  });

  it("redirects oauth=token_failed when Graph returns an OAuthException (not 500)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: { message: "redirect_uri mismatch", type: "OAuthException" } }),
      }),
    );
    const res = await facebookCallback(callbackEnv());
    expectAppRedirect(res, "token_failed");
  });

  it("redirects oauth=token_failed when Graph returns HTTP 200 with an error object", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ error: { message: "Invalid verification code format", type: "OAuthException" } }),
      }),
    );
    const res = await facebookCallback(callbackEnv());
    expectAppRedirect(res, "token_failed");
  });

  it("redirects oauth=token_failed when Graph fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const res = await facebookCallback(callbackEnv());
    expectAppRedirect(res, "token_failed");
  });

  it("redirects oauth=token_failed when META_APP_SECRET is missing", async () => {
    const res = await facebookCallback(callbackEnv({ META_APP_SECRET: "" }));
    expectAppRedirect(res, "token_failed");
  });

  it("exchanges against the dashboard callback URL even if BETTER_AUTH_URL has a trailing slash", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { type: "OAuthException", message: "redirect_uri mismatch" } }),
    });
    vi.stubGlobal("fetch", fetch);
    const res = await facebookCallback(callbackEnv({ BETTER_AUTH_URL: "https://api.duskly.site/" }));
    expectAppRedirect(res, "token_failed");
    expect(fetch).toHaveBeenCalled();
    const called = String(fetch.mock.calls[0][0]);
    const q = new URL(called).searchParams;
    expect(q.get("redirect_uri")).toBe("https://api.duskly.site/v1/accounts/oauth/facebook/callback");
    expect(q.get("client_id")).toBe("meta-id");
  });

  it("redirects oauth=error when persist/encrypt throws after a successful token exchange", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.includes("/oauth/access_token") && !u.includes("fb_exchange_token")) {
          return { ok: true, json: async () => ({ access_token: "short-token" }) };
        }
        if (u.includes("fb_exchange_token")) {
          return { ok: true, json: async () => ({ access_token: "long-token" }) };
        }
        if (u.includes("/me?") && u.includes("fields=id")) {
          return { ok: true, json: async () => ({ id: "99" }) };
        }
        if (u.includes("/me/accounts")) {
          return {
            ok: true,
            json: async () => ({ data: [{ id: "p1", name: "Page", access_token: "page-token" }] }),
          };
        }
        return { ok: false, json: async () => ({}) };
      }),
    );
    const res = await facebookCallback(callbackEnv({ TOKEN_ENCRYPTION_KEY: "not-a-32-byte-key" }));
    expectAppRedirect(res, "error");
  });

  it("ignores Facebook's #_=_ fragment and still returns a redirect", async () => {
    const res = await worker.fetch(
      new Request(
        `https://api.duskly.site/v1/accounts/oauth/facebook/callback?code=test-code&state=${FB_STATE}#_=_`,
      ),
      callbackEnv({ KV: memoryKv() }),
      {} as ExecutionContext,
    );
    expectAppRedirect(res, "expired");
  });
});
