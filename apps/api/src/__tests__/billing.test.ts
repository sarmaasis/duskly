import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { billingRoutes, productId } from "../routes/billing";
import { isCloud } from "../lib/dodo";
import type { Env } from "../env";

function env(partial: Partial<Env> = {}): Env {
  return { DUSKLY_MODE: "cloud", ...partial } as Env;
}

function app() {
  const h = new Hono<{ Bindings: Env; Variables: { userId: string; email?: string } }>();
  h.use("*", async (c, next) => {
    c.set("userId", "user-1");
    await next();
  });
  h.route("/", billingRoutes);
  return h;
}

describe("billing product ids", () => {
  it("returns null when the Dodo product env var is missing — no Pro fallback", () => {
    const e = env({});
    expect(productId(e, "standard", "month")).toBeNull();
    expect(productId(e, "team", "year")).toBeNull();
    expect(productId(e, "pro", "month")).toBeNull();
    expect(productId(e, "ultimate", "month")).toBeNull();
  });

  it("reads the plan-specific env var and ignores other plans' ids", () => {
    const e = env({
      DODO_PRO_MONTHLY_PRODUCT_ID: "prod_pro",
      DODO_STANDARD_MONTHLY_PRODUCT_ID: "prod_std",
    });
    expect(productId(e, "pro", "month")).toBe("prod_pro");
    expect(productId(e, "standard", "month")).toBe("prod_std");
    expect(productId(e, "team", "month")).toBeNull();
    expect(productId(e, "pro", "year")).toBeNull();
  });

  it("treats whitespace-only product ids as missing", () => {
    expect(productId(env({ DODO_PRO_MONTHLY_PRODUCT_ID: "   " }), "pro", "month")).toBeNull();
  });

  it("checkout returns 503 product_missing, not a Pro cart, when the id is unset", async () => {
    const res = await app().request(
      "/checkout",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan: "standard" }) },
      env({}),
    );
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toMatchObject({ error: "product_missing" });
    expect(JSON.stringify(body)).not.toMatch(/prod_pro|pro\//i);
    expect(body.message).toMatch(/DODO_STANDARD_MONTHLY_PRODUCT_ID/);
  });

  it("does not substitute Pro when Team yearly is missing", async () => {
    const res = await app().request(
      "/checkout",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: "team", interval: "year" }),
      },
      env({ DODO_PRO_YEARLY_PRODUCT_ID: "prod_pro_year" }),
    );
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("product_missing");
    expect(body.message).toMatch(/DODO_TEAM_YEARLY_PRODUCT_ID/);
  });

  it("rejects unknown plans before looking up a product", async () => {
    const res = await app().request(
      "/checkout",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan: "enterprise" }) },
      env({}),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_plan" });
  });

  it("hides checkout on self-host", async () => {
    const res = await app().request(
      "/checkout",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan: "pro" }) },
      env({ DUSKLY_MODE: "selfhost" }),
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "selfhost" });
  });

  it("isCloud is true only for DUSKLY_MODE=cloud", () => {
    expect(isCloud(env({ DUSKLY_MODE: "cloud" }))).toBe(true);
    expect(isCloud(env({ DUSKLY_MODE: "selfhost" }))).toBe(false);
  });
});
