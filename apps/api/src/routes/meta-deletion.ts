import { Hono } from "hono";
import type { Env } from "../env";

export const metaDeletionRoutes = new Hono<{ Bindings: Env }>();

function b64urlToBytes(value: string): Uint8Array {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToB64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function parseMetaSignedRequest(
  signedRequest: string,
  appSecret: string,
): Promise<{ user_id?: string } | null> {
  const [encodedSig, encodedPayload] = signedRequest.split(".");
  if (!encodedSig || !encodedPayload) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = bytesToB64url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encodedPayload)));
  const given = encodedSig.replace(/=+$/, "");
  if (expected !== given) return null;
  try {
    const json = new TextDecoder().decode(b64urlToBytes(encodedPayload));
    return JSON.parse(json) as { user_id?: string };
  } catch {
    return null;
  }
}

function deletionResponse(env: Env, code: string) {
  const origin = env.WEB_ORIGIN || "https://duskly.site";
  return {
    url: `${origin}/data-deletion?code=${encodeURIComponent(code)}`,
    confirmation_code: code,
  };
}

async function handleDeletion(c: { env: Env; req: { query: (k: string) => string | undefined; parseBody: () => Promise<Record<string, string | File>> } }) {
  const env = c.env;
  let signed = c.req.query("signed_request") || c.req.query("signedRequest") || "";
  if (!signed) {
    try {
      const body = await c.req.parseBody();
      const raw = body.signed_request || body.signedRequest || "";
      signed = typeof raw === "string" ? raw : "";
    } catch {
      signed = "";
    }
  }
  let code = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  if (signed && env.META_APP_SECRET) {
    const parsed = await parseMetaSignedRequest(signed, env.META_APP_SECRET);
    if (parsed?.user_id) code = `meta_${parsed.user_id}`.slice(0, 48);
  }
  return deletionResponse(env, code);
}

metaDeletionRoutes.get("/", async (c) => {
  const payload = await handleDeletion(c);
  return c.json(payload);
});

metaDeletionRoutes.post("/", async (c) => {
  const payload = await handleDeletion(c);
  return c.json(payload);
});
