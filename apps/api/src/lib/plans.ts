export type PlanId = "standard" | "team" | "pro" | "ultimate";

export type PlanLimits = {
  channels: number;
  team: boolean;
  aiImages: number;
  aiVideos: number;
  aiClipMinutes: number;
  aiCopilot: number;
};

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  standard: { channels: 5, team: false, aiImages: 0, aiVideos: 3, aiClipMinutes: 60, aiCopilot: 200 },
  team: { channels: 10, team: true, aiImages: 100, aiVideos: 10, aiClipMinutes: 120, aiCopilot: 500 },
  pro: { channels: 30, team: true, aiImages: 300, aiVideos: 30, aiClipMinutes: 300, aiCopilot: 2000 },
  ultimate: { channels: 100, team: true, aiImages: 500, aiVideos: 60, aiClipMinutes: 600, aiCopilot: 5000 },
};

export function isPlanId(v: string): v is PlanId {
  return v in PLAN_LIMITS;
}

export function resolvePlan(plan: string | null | undefined, mode: "selfhost" | "cloud"): PlanId | "selfhost" {
  if (mode === "selfhost") return "selfhost";
  if (plan && isPlanId(plan)) return plan;
  return "standard";
}

export function limitsFor(plan: PlanId | "selfhost"): PlanLimits {
  if (plan === "selfhost") {
    return { channels: 10_000, team: true, aiImages: 10_000, aiVideos: 10_000, aiClipMinutes: 10_000, aiCopilot: 10_000 };
  }
  return PLAN_LIMITS[plan];
}

export function periodKey(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
