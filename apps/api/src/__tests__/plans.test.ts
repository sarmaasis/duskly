import { describe, expect, it } from "vitest";
import { PLAN_LIMITS, isPlanId, limitsFor, periodKey, resolvePlan } from "../lib/plans";

describe("plan limits", () => {
  it("gives Standard 5 channels, no team, and the documented AI quotas", () => {
    expect(PLAN_LIMITS.standard).toEqual({
      channels: 5,
      team: false,
      aiImages: 0,
      aiVideos: 3,
      aiClipMinutes: 3,
      aiCopilot: 200,
    });
  });

  it("gives Team 10 channels and team seats", () => {
    expect(PLAN_LIMITS.team).toEqual({
      channels: 10,
      team: true,
      aiImages: 100,
      aiVideos: 10,
      aiClipMinutes: 10,
      aiCopilot: 500,
    });
  });

  it("gives Pro 30 channels", () => {
    expect(PLAN_LIMITS.pro.channels).toBe(30);
    expect(PLAN_LIMITS.pro.team).toBe(true);
    expect(PLAN_LIMITS.pro.aiImages).toBe(300);
    expect(PLAN_LIMITS.pro.aiVideos).toBe(30);
    expect(PLAN_LIMITS.pro.aiClipMinutes).toBe(30);
    expect(PLAN_LIMITS.pro.aiCopilot).toBe(2000);
  });

  it("gives Ultimate 100 channels", () => {
    expect(PLAN_LIMITS.ultimate.channels).toBe(100);
    expect(PLAN_LIMITS.ultimate.team).toBe(true);
    expect(PLAN_LIMITS.ultimate.aiImages).toBe(500);
    expect(PLAN_LIMITS.ultimate.aiVideos).toBe(60);
    expect(PLAN_LIMITS.ultimate.aiClipMinutes).toBe(60);
    expect(PLAN_LIMITS.ultimate.aiCopilot).toBe(5000);
  });

  it("turns limits off for self-host", () => {
    const limits = limitsFor("selfhost");
    expect(limits.channels).toBe(10_000);
    expect(limits.team).toBe(true);
    expect(limits.aiImages).toBe(10_000);
    expect(limits.aiVideos).toBe(10_000);
    expect(limits.aiClipMinutes).toBe(10_000);
    expect(limits.aiCopilot).toBe(10_000);
  });

  it("resolves cloud unknown/empty plan to standard, never to pro", () => {
    expect(resolvePlan(null, "cloud")).toBe("standard");
    expect(resolvePlan(undefined, "cloud")).toBe("standard");
    expect(resolvePlan("hobby", "cloud")).toBe("standard");
    expect(resolvePlan("pro", "cloud")).toBe("pro");
    expect(resolvePlan("standard", "selfhost")).toBe("selfhost");
    expect(resolvePlan("ultimate", "selfhost")).toBe("selfhost");
  });

  it("accepts only the four paid plan ids", () => {
    expect(isPlanId("standard")).toBe(true);
    expect(isPlanId("team")).toBe(true);
    expect(isPlanId("pro")).toBe(true);
    expect(isPlanId("ultimate")).toBe(true);
    expect(isPlanId("selfhost")).toBe(false);
    expect(isPlanId("enterprise")).toBe(false);
  });

  it("uses UTC year-month for the usage period", () => {
    expect(periodKey(new Date("2026-09-23T22:00:00Z"))).toBe("2026-09");
    expect(periodKey(new Date("2026-01-01T00:00:00Z"))).toBe("2026-01");
  });
});
