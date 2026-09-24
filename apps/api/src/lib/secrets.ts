import type { Env } from "../env";

const PREFIX = "enc:v1:";
export const TOKEN_KEY_MISSING = "TOKEN_ENCRYPTION_KEY is not set";
const ENCRYPT_FAILED_PREFIX = "Token encrypt failed";

function bytesToBase64(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function base64ToBytes(value: string) {
  const bin = atob(value);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

/** 32-byte AES material: 64-hex, 32-byte base64, or SHA-256 of any other secret. */
async function keyMaterial(env: Env): Promise<ArrayBuffer> {
  const raw = (env.TOKEN_ENCRYPTION_KEY || "").trim();
  if (!raw) throw new Error(TOKEN_KEY_MISSING);
  if (/^[0-9a-f]{64}$/i.test(raw)) {
    const bytes = Uint8Array.from(raw.match(/../g)!, (b) => parseInt(b, 16));
    return toArrayBuffer(bytes);
  }
  try {
    const decoded = base64ToBytes(raw);
    if (decoded.byteLength === 32) return toArrayBuffer(decoded);
  } catch {
    /* passphrase / other */
  }
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
}

function cryptoErrorName(e: unknown) {
  return e instanceof Error && e.name ? e.name : "Error";
}

function wrapCryptoError(e: unknown): never {
  if (e instanceof Error && (e.message === TOKEN_KEY_MISSING || e.message.startsWith(ENCRYPT_FAILED_PREFIX))) {
    throw e;
  }
  throw new Error(`${ENCRYPT_FAILED_PREFIX} (${cryptoErrorName(e)})`);
}

async function aesKey(env: Env) {
  try {
    return await crypto.subtle.importKey("raw", await keyMaterial(env), { name: "AES-GCM" }, false, [
      "encrypt",
      "decrypt",
    ]);
  } catch (e) {
    wrapCryptoError(e);
  }
}

export function encryptFailureDetail(e: unknown): string {
  const msg = e instanceof Error ? e.message : "";
  if (!msg || msg === TOKEN_KEY_MISSING) return "missing";
  if (/invalid length/i.test(msg)) return "invalid length";
  const named = msg.match(/Token encrypt failed \(([^)]+)\)/);
  if (named?.[1]) return named[1];
  if (e instanceof Error && e.name && e.name !== "Error") return e.name;
  return "crypto";
}

export function isTokenEncryptError(e: unknown) {
  const msg = e instanceof Error ? e.message : "";
  return msg === TOKEN_KEY_MISSING || msg.startsWith(ENCRYPT_FAILED_PREFIX) || /TOKEN_ENCRYPTION_KEY/i.test(msg);
}

export async function encryptSecret(env: Env, value: string) {
  if (!value || value === "pending" || value.startsWith(PREFIX)) return value;
  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await aesKey(env),
      new TextEncoder().encode(value),
    );
    return `${PREFIX}${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(cipher))}`;
  } catch (e) {
    wrapCryptoError(e);
  }
}

export async function decryptSecret(env: Env, value: string) {
  if (!value.startsWith(PREFIX)) return value;
  const [, ivRaw, cipherRaw] = value.slice(PREFIX.length).match(/^([^:]+):(.+)$/) || [];
  if (!ivRaw || !cipherRaw) throw new Error("Invalid encrypted secret");
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(ivRaw) },
      await aesKey(env),
      base64ToBytes(cipherRaw),
    );
    return new TextDecoder().decode(plain);
  } catch (e) {
    wrapCryptoError(e);
  }
}

export async function encryptCredentials(env: Env, creds: Record<string, string>) {
  return Object.keys(creds).length ? encryptSecret(env, JSON.stringify(creds)) : null;
}

export async function decryptCredentials(env: Env, raw: string | null | undefined) {
  if (!raw) return undefined;
  return JSON.parse(await decryptSecret(env, raw)) as Record<string, string>;
}
