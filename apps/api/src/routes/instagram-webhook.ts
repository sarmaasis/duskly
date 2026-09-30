import { Hono } from "hono";
import type { Env } from "../env";

export const instagramWebhookRoutes = new Hono<{ Bindings: Env }>();

instagramWebhookRoutes.get("/", (c) => {
  const mode = c.req.query("hub.mode");
  const token = c.req.query("hub.verify_token");
  const challenge = c.req.query("hub.challenge");
  const expected = c.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN?.trim();
  if (mode === "subscribe" && expected && token === expected && challenge != null) {
    return c.text(challenge, 200);
  }
  return c.text("forbidden", 403);
});

instagramWebhookRoutes.post("/", () => new Response(null, { status: 200 }));
