import { Hono } from "hono";
import { dodo, isCloud } from "../lib/dodo";
import type { Env } from "../env";

export const billingRoutes = new Hono<{ Bindings: Env; Variables: { userId: string; email?: string } }>();

billingRoutes.post("/checkout", async (c) => {
  if (!isCloud(c.env)) return c.json({ error: "selfhost" }, 404);
  const { interval } = (await c.req.json()) as { interval?: "month" | "year" };
  const product_id =
    interval === "year" ? c.env.DODO_PRO_YEARLY_PRODUCT_ID : c.env.DODO_PRO_MONTHLY_PRODUCT_ID;
  const session = await dodo(c.env).checkoutSessions.create({
    product_cart: [{ product_id, quantity: 1 }],
    customer: { email: c.get("email") ?? undefined },
    metadata: { userId: c.get("userId"), workspaceMode: "cloud" },
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
  const data = (event as { data?: Record<string, unknown> }).data ?? {};
  await env.KV.put(
    `dodo:${type}:${String(data.subscription_id ?? data.payment_id ?? crypto.randomUUID())}`,
    raw,
    { expirationTtl: 60 * 60 * 24 * 30 },
  );
  return Response.json({ ok: true });
}
