import { describe, expect, it } from "vitest";
import { limitRequest, takeToken } from "../lib/rate-limit";
import { cacheGet, cacheSet, clearReadCache } from "../lib/read-cache";

describe("rate limit", () => {
  it("allows a burst under the ceiling and then refuses", () => {
    const key = `test:${crypto.randomUUID()}`;
    expect(takeToken(key, 2, 60_000).ok).toBe(true);
    expect(takeToken(key, 2, 60_000).ok).toBe(true);
    expect(takeToken(key, 2, 60_000).ok).toBe(false);
  });

  it("does not count requests that have no client address", () => {
    expect(limitRequest("/v1/posts", "GET", "")).toBeNull();
    expect(limitRequest("/healthz", "GET", "1.1.1.1")).toBeNull();
  });

  it("limits sign-in code requests more tightly than ordinary API reads", () => {
    const ip = `203.0.113.${crypto.randomUUID().slice(0, 3)}`;
    let blocked = false;
    for (let i = 0; i < 9; i++) {
      const hit = limitRequest("/api/auth/email-otp/send-verification-otp", "POST", ip);
      if (hit) blocked = true;
    }
    expect(blocked).toBe(true);
    expect(limitRequest("/v1/posts", "GET", ip)).toBeNull();
  });
});

describe("read cache", () => {
  it("returns a fresh value and drops it when writes clear the cache", () => {
    const key = `row:${crypto.randomUUID()}`;
    cacheSet(key, { id: "1" }, 15_000);
    expect(cacheGet<{ id: string }>(key)?.id).toBe("1");
    clearReadCache();
    expect(cacheGet(key)).toBeUndefined();
  });
});
