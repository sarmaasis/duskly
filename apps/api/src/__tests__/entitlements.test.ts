import { describe, expect, it } from "vitest";
import { PlanError, planErrorResponse } from "../lib/entitlements";
import { hmacSign, sha256Hex } from "../lib/workspace";
import { makePosterSvg } from "../lib/media-gen";

describe("plan errors", () => {
  it("uses 402 with a stable code", () => {
    const err = new PlanError("team_blocked", "Team seats require Team plan or higher");
    expect(err.status).toBe(402);
    expect(err.code).toBe("team_blocked");
  });

  it("serializes PlanError and ignores other errors", async () => {
    const res = planErrorResponse(new PlanError("quota_zero", "aiImages is not included on standard"));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(402);
    expect(await res!.json()).toEqual({ error: "quota_zero", message: "aiImages is not included on standard" });
    expect(planErrorResponse(new Error("boom"))).toBeNull();
  });
});

describe("workspace crypto helpers", () => {
  it("sha256Hex is stable", async () => {
    expect(await sha256Hex("dk_test")).toMatch(/^[0-9a-f]{64}$/);
    expect(await sha256Hex("dk_test")).toBe(await sha256Hex("dk_test"));
    expect(await sha256Hex("dk_test")).not.toBe(await sha256Hex("dk_other"));
  });

  it("hmacSign is deterministic for the same secret+body", async () => {
    const a = await hmacSign("secret", '{"ok":true}');
    const b = await hmacSign("secret", '{"ok":true}');
    const c = await hmacSign("other", '{"ok":true}');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("AI image fallback poster", () => {
  it("escapes markup and never claims to be a video", () => {
    const svg = makePosterSvg("<script>x</script>", "overlay&");
    expect(svg).toContain("<svg");
    expect(svg).not.toContain("<script>");
    expect(svg).not.toContain("&");
    expect(svg).not.toMatch(/video|webm|mp4/i);
  });
});
