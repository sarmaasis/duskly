import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, inArray } from "drizzle-orm";
import { socialAccount } from "../db/schema";
import type { Env } from "../env";
import { META_NETWORKS, wipeMatchingMetaAccounts } from "../lib/meta-deletion";

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

async function loadMetaAccounts(env: Env) {
  if (!env.DB) return [];
  try {
    const db = drizzle(env.DB);
    return await db
      .select({
        id: socialAccount.id,
        network: socialAccount.network,
        credentialsJson: socialAccount.credentialsJson,
      })
      .from(socialAccount)
      .where(inArray(socialAccount.network, [...META_NETWORKS]));
  } catch {
    return [];
  }
}

export async function applyMetaDataDeletion(env: Env, metaUserId: string): Promise<string[]> {
  const rows = await loadMetaAccounts(env);
  const db = env.DB ? drizzle(env.DB) : null;
  return wipeMatchingMetaAccounts(env, rows, metaUserId, async (id, tokenCipher, credentialsJson, status) => {
    if (!db) return;
    await db.update(socialAccount).set({ tokenCipher, credentialsJson, status }).where(eq(socialAccount.id, id));
  });
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
  let userId: string | undefined;
  if (signed && env.META_APP_SECRET) {
    const parsed = await parseMetaSignedRequest(signed, env.META_APP_SECRET);
    if (parsed?.user_id) {
      userId = parsed.user_id;
      code = `meta_${parsed.user_id}`.slice(0, 48);
    }
  }
  let deletedAccountIds: string[] = [];
  if (userId) {
    try {
      deletedAccountIds = await applyMetaDataDeletion(env, userId);
    } catch {
      deletedAccountIds = [];
    }
  }
  try {
    await env.KV?.put(
      `meta-deletion:${code}`,
      JSON.stringify({
        userId: userId || null,
        deletedAccountIds,
        at: Date.now(),
      }),
      { expirationTtl: 60 * 60 * 24 * 90 },
    );
  } catch {
    /* confirmation still returned even if KV is unavailable */
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
