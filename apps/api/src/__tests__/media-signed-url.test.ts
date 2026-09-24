import { describe, expect, it } from "vitest";
import worker from "../index";
import type { Env } from "../env";
import { mediaRoutes } from "../routes/media";
import {
  PROD_API_ORIGIN,
  PUBLIC_MEDIA_TTL_SEC,
  apiPublicOrigin,
  signPublicMediaSig,
  signPublicMediaUrl,
  verifyPublicMediaSig,
} from "../lib/media-signed-url";

const TOKEN_ENCRYPTION_KEY = "a".repeat(64);
const env = {
  TOKEN_ENCRYPTION_KEY,
  BETTER_AUTH_URL: "https://api.duskly.test",
  WEB_ORIGIN: "https://duskly.site",
} as Env;

function mockD1(row: Record<string, unknown> | null) {
  const results = row ? [row] : [];
  const stmt = {
    bind: (..._args: unknown[]) => stmt,
    all: async () => ({ results, success: true }),
    first: async () => row,
    run: async () => ({ success: true }),
    raw: async () => results.map((r) => Object.values(r)),
  };
  return {
    prepare: (_sql: string) => stmt,
    batch: async (stmts: unknown[]) => stmts,
  };
}

function mockR2(objects: Record<string, string>) {
  return {
    get: async (key: string) => {
      const body = objects[key];
      if (body == null) return null;
      return { body: new Blob([body]) };
    },
  };
}

describe("public media signer", () => {
  it("signs a time-limited URL and verifies the matching signature", async () => {
    const now = 1_700_000_000_000;
    const url = await signPublicMediaUrl(env, "media-1", now);
    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/v1/media/media-1/public");
    expect(Number(parsed.searchParams.get("exp"))).toBe(Math.floor(now / 1000) + PUBLIC_MEDIA_TTL_SEC);
    expect(
      await verifyPublicMediaSig(env, "media-1", parsed.searchParams.get("exp")!, parsed.searchParams.get("sig")!, now),
    ).toBe(true);
  });

  it("uses BETTER_AUTH_URL as an absolute origin and never a relative path", async () => {
    const prod = { TOKEN_ENCRYPTION_KEY, BETTER_AUTH_URL: "https://api.duskly.site" } as Env;
    const url = await signPublicMediaUrl(prod, "abc");
    expect(url.startsWith("https://api.duskly.site/v1/media/abc/public?")).toBe(true);
    expect(url.startsWith("/")).toBe(false);
    expect(url).not.toContain("localhost");
    expect(apiPublicOrigin({} as Env)).toBe(PROD_API_ORIGIN);
    expect(apiPublicOrigin({ BETTER_AUTH_URL: "not-a-url" } as Env)).toBe(PROD_API_ORIGIN);
  });

  it("rejects a tampered signature, the wrong id, and an expired exp", async () => {
    const now = 1_700_000_000_000;
    const exp = Math.floor(now / 1000) + PUBLIC_MEDIA_TTL_SEC;
    const sig = await signPublicMediaSig(env, "media-1", exp);
    expect(await verifyPublicMediaSig(env, "media-1", String(exp), `${sig.slice(0, -1)}0`, now)).toBe(false);
    expect(await verifyPublicMediaSig(env, "media-2", String(exp), sig, now)).toBe(false);
    expect(await verifyPublicMediaSig(env, "media-1", String(Math.floor(now / 1000) - 10), sig, now)).toBe(false);
    expect(await verifyPublicMediaSig(env, "media-1", String(exp), sig, now + PUBLIC_MEDIA_TTL_SEC * 1000 + 1000)).toBe(
      false,
    );
  });
});

describe("unauthenticated public media fetch", () => {
  it("GET /v1/media/:id/public is reachable without a session and rejects a bad signature", async () => {
    const res = await worker.fetch(
      new Request("https://api.duskly.test/v1/media/media-1/public?exp=9999999999&sig=nope"),
      { ...env } as Env,
      {} as ExecutionContext,
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "invalid_signature" });
  });

  it("serves the R2 object when the signature and expiry are valid", async () => {
    const now = Date.now();
    const exp = Math.floor(now / 1000) + 600;
    const sig = await signPublicMediaSig(env, "media-1", exp);
    const bindings = {
      ...env,
      DB: mockD1({
        id: "media-1",
        workspace_id: "ws1",
        r2_key: "ws1/pic.jpg",
        content_type: "image/jpeg",
        bytes: 2,
        kind: "image",
        meta_json: null,
      }),
      MEDIA: mockR2({ "ws1/pic.jpg": "hi" }),
    } as unknown as Env;
    const res = await mediaRoutes.request(`/media-1/public?exp=${exp}&sig=${sig}`, {}, bindings);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(await res.text()).toBe("hi");
  });
});
