import type { Env } from "../env";

const PREFIX = "enc:v1:";

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

function keyBytes(env: Env) {
  const raw = (env.TOKEN_ENCRYPTION_KEY || "").trim();
  if (/^[0-9a-f]{64}$/i.test(raw)) {
    return Uint8Array.from(raw.match(/../g)!, (b) => parseInt(b, 16));
  }
  try {
    const decoded = base64ToBytes(raw);
    if (decoded.byteLength === 32) return decoded;
  } catch {
    /* fall through */
  }
  throw new Error("TOKEN_ENCRYPTION_KEY must be a 32-byte hex or base64 key");
}

async function aesKey(env: Env) {
  return crypto.subtle.importKey("raw", keyBytes(env), "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(env: Env, value: string) {
  if (!value || value === "pending" || value.startsWith(PREFIX)) return value;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await aesKey(env),
    new TextEncoder().encode(value),
  );
  return `${PREFIX}${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(cipher))}`;
}

export async function decryptSecret(env: Env, value: string) {
  if (!value.startsWith(PREFIX)) return value;
  const [, ivRaw, cipherRaw] = value.slice(PREFIX.length).match(/^([^:]+):(.+)$/) || [];
  if (!ivRaw || !cipherRaw) throw new Error("Invalid encrypted secret");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(ivRaw) },
    await aesKey(env),
    base64ToBytes(cipherRaw),
  );
  return new TextDecoder().decode(plain);
}

export async function encryptCredentials(env: Env, creds: Record<string, string>) {
  return Object.keys(creds).length ? encryptSecret(env, JSON.stringify(creds)) : null;
}

export async function decryptCredentials(env: Env, raw: string | null | undefined) {
  if (!raw) return undefined;
  return JSON.parse(await decryptSecret(env, raw)) as Record<string, string>;
}
