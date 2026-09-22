import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import { outboundWebhook } from "../db/schema";
import type { Env } from "../env";
import { hmacSign } from "./workspace";

export async function dispatchWebhooks(
  env: Env,
  workspaceId: string,
  event: string,
  payload: Record<string, unknown>,
) {
  const db = drizzle(env.DB);
  const hooks = await db
    .select()
    .from(outboundWebhook)
    .where(and(eq(outboundWebhook.workspaceId, workspaceId), eq(outboundWebhook.active, true)));
  const body = JSON.stringify({ event, createdAt: new Date().toISOString(), ...payload });
  await Promise.all(
    hooks.map(async (h) => {
      const events = JSON.parse(h.events || "[]") as string[];
      if (!events.includes(event) && !events.includes("*")) return;
      const signature = await hmacSign(h.secret, body);
      try {
        await fetch(h.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-duskly-signature": signature,
            "x-duskly-event": event,
          },
          body,
        });
      } catch {
        /* best-effort delivery */
      }
    }),
  );
}
