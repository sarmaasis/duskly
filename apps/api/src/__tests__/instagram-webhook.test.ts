import { describe, expect, it } from "vitest";
import worker from "../index";
import type { Env } from "../env";

function env(overrides: Record<string, unknown> = {}): Env {
  return {
    WEB_ORIGIN: "https://duskly.site",
    INSTAGRAM_WEBHOOK_VERIFY_TOKEN: "test-verify-token",
    ...overrides,
  } as unknown as Env;
}

function challengeRequest(query: string) {
  return new Request(`https://api.duskly.site/v1/instagram/webhook?${query}`);
}

describe("Instagram webhook challenge", () => {
  it("returns hub.challenge as text/plain when mode is subscribe and the verify token matches", async () => {
    const res = await worker.fetch(
      challengeRequest("hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=18339880"),
      env(),
      {} as ExecutionContext,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") || "").toMatch(/text\/plain/);
    expect(await res.text()).toBe("18339880");
  });

  it("returns 403 when the verify token does not match", async () => {
    const res = await worker.fetch(
      challengeRequest("hub.mode=subscribe&hub.verify_token=wrong-token&hub.challenge=18339880"),
      env(),
      {} as ExecutionContext,
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 on POST so Meta can deliver later", async () => {
    const res = await worker.fetch(
      new Request("https://api.duskly.site/v1/instagram/webhook", { method: "POST" }),
      env(),
      {} as ExecutionContext,
    );
    expect(res.status).toBe(200);
  });
});
