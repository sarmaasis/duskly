import DodoPayments from "dodopayments";
import type { Env } from "../env";

export function dodo(env: Env) {
  return new DodoPayments({
    bearerToken: env.DODO_PAYMENTS_API_KEY,
    webhookKey: env.DODO_PAYMENTS_WEBHOOK_KEY,
    environment: env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "live_mode" : "test_mode",
  });
}

export function isCloud(env: Env) {
  return env.CUEORA_MODE === "cloud";
}
