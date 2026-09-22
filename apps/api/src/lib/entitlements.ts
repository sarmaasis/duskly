import { drizzle } from "drizzle-orm/d1";
import { and, eq, count } from "drizzle-orm";
import { socialAccount, usageCounter, workspace, workspaceMember } from "../db/schema";
import type { Env } from "../env";
import { limitsFor, periodKey, resolvePlan, type PlanLimits } from "./plans";
import { isCloud } from "./dodo";

export class PlanError extends Error {
  status = 402;
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export async function getWorkspacePlan(env: Env, workspaceId: string) {
  const db = drizzle(env.DB);
  const [ws] = await db.select().from(workspace).where(eq(workspace.id, workspaceId)).limit(1);
  if (!ws) throw new PlanError("workspace_missing", "Workspace not found");
  const mode = isCloud(env) ? "cloud" : "selfhost";
  const plan = resolvePlan(ws.plan, mode);
  return { workspace: ws, plan, limits: limitsFor(plan), mode };
}

export async function assertChannelLimit(env: Env, workspaceId: string, adding = 1) {
  const { limits, plan } = await getWorkspacePlan(env, workspaceId);
  if (plan === "selfhost") return;
  const db = drizzle(env.DB);
  const [row] = await db
    .select({ c: count() })
    .from(socialAccount)
    .where(eq(socialAccount.workspaceId, workspaceId));
  if ((row?.c ?? 0) + adding > limits.channels) {
    throw new PlanError("channel_limit", `Plan allows ${limits.channels} channels`);
  }
}

export async function assertTeamAllowed(env: Env, workspaceId: string) {
  const { limits } = await getWorkspacePlan(env, workspaceId);
  if (!limits.team) throw new PlanError("team_blocked", "Team seats require Team plan or higher");
}

export async function assertQuota(
  env: Env,
  workspaceId: string,
  kind: keyof Pick<PlanLimits, "aiImages" | "aiVideos" | "aiClipMinutes" | "aiCopilot">,
  amount = 1,
) {
  const { limits, plan } = await getWorkspacePlan(env, workspaceId);
  const limit = limits[kind];
  if (limit <= 0) throw new PlanError("quota_zero", `${kind} is not included on ${plan}`);
  const db = drizzle(env.DB);
  const period = periodKey();
  const [row] = await db
    .select()
    .from(usageCounter)
    .where(
      and(
        eq(usageCounter.workspaceId, workspaceId),
        eq(usageCounter.period, period),
        eq(usageCounter.kind, kind),
      ),
    )
    .limit(1);
  const used = row?.used ?? 0;
  if (used + amount > limit) {
    throw new PlanError("quota_exceeded", `${kind} monthly quota exceeded (${used}/${limit})`);
  }
}

export async function consumeQuota(
  env: Env,
  workspaceId: string,
  kind: keyof Pick<PlanLimits, "aiImages" | "aiVideos" | "aiClipMinutes" | "aiCopilot">,
  amount = 1,
) {
  await assertQuota(env, workspaceId, kind, amount);
  const db = drizzle(env.DB);
  const period = periodKey();
  const [row] = await db
    .select()
    .from(usageCounter)
    .where(
      and(
        eq(usageCounter.workspaceId, workspaceId),
        eq(usageCounter.period, period),
        eq(usageCounter.kind, kind),
      ),
    )
    .limit(1);
  if (row) {
    await db
      .update(usageCounter)
      .set({ used: row.used + amount })
      .where(
        and(
          eq(usageCounter.workspaceId, workspaceId),
          eq(usageCounter.period, period),
          eq(usageCounter.kind, kind),
        ),
      );
  } else {
    await db.insert(usageCounter).values({ workspaceId, period, kind, used: amount });
  }
}

export async function usageSnapshot(env: Env, workspaceId: string) {
  const { limits, plan } = await getWorkspacePlan(env, workspaceId);
  const db = drizzle(env.DB);
  const period = periodKey();
  const rows = await db
    .select()
    .from(usageCounter)
    .where(and(eq(usageCounter.workspaceId, workspaceId), eq(usageCounter.period, period)));
  const used: Record<string, number> = {};
  for (const r of rows) used[r.kind] = r.used;
  const [channels] = await db
    .select({ c: count() })
    .from(socialAccount)
    .where(eq(socialAccount.workspaceId, workspaceId));
  const [members] = await db
    .select({ c: count() })
    .from(workspaceMember)
    .where(eq(workspaceMember.workspaceId, workspaceId));
  return {
    plan,
    period,
    limits,
    used: {
      aiImages: used.aiImages ?? 0,
      aiVideos: used.aiVideos ?? 0,
      aiClipMinutes: used.aiClipMinutes ?? 0,
      aiCopilot: used.aiCopilot ?? 0,
      channels: channels?.c ?? 0,
      members: members?.c ?? 0,
    },
  };
}

export function planErrorResponse(err: unknown) {
  if (err instanceof PlanError) {
    return Response.json({ error: err.code, message: err.message }, { status: err.status });
  }
  return null;
}
