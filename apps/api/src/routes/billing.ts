import { Hono } from "hono";
import { dodo, isCloud } from "../lib/dodo";
import type { Env } from "../env";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { workspace } from "../db/schema";
import { isPlanId, type PlanId } from "../lib/plans";

export const billingRoutes = new Hono<{ Bindings: Env; Variables: { userId: string; email?: string } }>();

function productId(env: Env, plan: PlanId, interval: "month" | "year"): string | null {
  const key = `DODO_${plan.toUpperCase()}_${interval === "year" ? "YEARLY" : "MONTHLY"}_PRODUCT_ID` as keyof Env;
  const fromEnv = env[key];
  if (typeof fromEnv === "string" && fromEnv.trim()) return fromEnv.trim();
  return null;
}

billingRoutes.post("/checkout", async (c) => {
  if (!isCloud(c.env)) return c.json({ error: "selfhost", message: "Checkout is only available on Duskly Cloud" }, 404);
  const body = (await c.req.json()) as {
    interval?: "month" | "year";
    plan?: string;
    workspaceId?: string;
  };
  if (!body.plan || !isPlanId(body.plan)) {
    return c.json({ error: "invalid_plan", message: "plan must be standard, team, pro, or ultimate" }, 400);
  }
  const plan = body.plan as PlanId;
  const interval = body.interval === "year" ? "year" : "month";
  const product_id = productId(c.env, plan, interval);
  if (!product_id) {
    return c.json(
      {
        error: "product_missing",
        message: `No Dodo product ID configured for ${plan}/${interval}. Set DODO_${plan.toUpperCase()}_${interval === "year" ? "YEARLY" : "MONTHLY"}_PRODUCT_ID.`,
      },
      503,
    );
  }
  if (!c.env.DODO_PAYMENTS_API_KEY) {
    return c.json({ error: "billing_unconfigured", message: "DODO_PAYMENTS_API_KEY is not set" }, 503);
  }
  const session = await dodo(c.env).checkoutSessions.create({
    product_cart: [{ product_id, quantity: 1 }],
    ...(c.get("email") ? { customer: { email: c.get("email")! } } : {}),
    metadata: {
      userId: c.get("userId"),
      workspaceId: body.workspaceId ?? "",
      plan,
      interval,
      workspaceMode: "cloud",
    },
    return_url: `${c.env.WEB_ORIGIN}/app/billing/success`,
  });
  return c.json({ checkout_url: session.checkout_url });
});

export async function handleDodoWebhook(request: Request, env: Env) {
  if (!isCloud(env)) return Response.json({ error: "selfhost" }, { status: 404 });
  const raw = await request.text();
  const event = dodo(env).webhooks.unwrap(raw, {
    headers: {
      "webhook-id": request.headers.get("webhook-id") ?? "",
      "webhook-signature": request.headers.get("webhook-signature") ?? "",
      "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
    },
  });
  const type = (event as { type?: string }).type ?? "";
  const data = ((event as { data?: unknown }).data ?? {}) as Record<string, unknown>;
  const meta = (data.metadata as Record<string, string> | undefined) ?? {};
  await env.KV.put(
    `dodo:${type}:${String(data.subscription_id ?? data.payment_id ?? crypto.randomUUID())}`,
    raw,
    { expirationTtl: 60 * 60 * 24 * 30 },
  );
  if (meta.workspaceId && meta.plan && isPlanId(meta.plan)) {
    const db = drizzle(env.DB);
    await db.update(workspace).set({ plan: meta.plan }).where(eq(workspace.id, meta.workspaceId));
  }
  return Response.json({ ok: true });
}
