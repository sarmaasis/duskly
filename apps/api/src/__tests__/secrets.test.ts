import { describe, expect, it } from "vitest";
import {
  decryptCredentials,
  decryptSecret,
  encryptCredentials,
  encryptFailureDetail,
  encryptSecret,
  isTokenEncryptError,
  TOKEN_KEY_MISSING,
} from "../lib/secrets";
import type { Env } from "../env";

const env = { TOKEN_ENCRYPTION_KEY: "a".repeat(64) } as Env;

describe("secret encryption", () => {
  it("round-trips a token", async () => {
    const cipher = await encryptSecret(env, "xoxb-secret");
    expect(cipher.startsWith("enc:v1:")).toBe(true);
    expect(await decryptSecret(env, cipher)).toBe("xoxb-secret");
  });

  it("round-trips with a 32-byte base64 key", async () => {
    const bytes = new Uint8Array(32);
    bytes.fill(7);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    const base64Env = { TOKEN_ENCRYPTION_KEY: btoa(bin) } as Env;
    const cipher = await encryptSecret(base64Env, "page-token");
    expect(await decryptSecret(base64Env, cipher)).toBe("page-token");
  });

  it("derives AES-256 from a non-hex passphrase and round-trips", async () => {
    const passEnv = { TOKEN_ENCRYPTION_KEY: "not-a-32-byte-key" } as Env;
    const cipher = await encryptSecret(passEnv, "EAA-not-logged");
    expect(cipher.startsWith("enc:v1:")).toBe(true);
    expect(await decryptSecret(passEnv, cipher)).toBe("EAA-not-logged");
  });

  it("keeps hex-64 and passphrase derivations distinct", async () => {
    const passEnv = { TOKEN_ENCRYPTION_KEY: "not-a-32-byte-key" } as Env;
    const cipher = await encryptSecret(env, "shared");
    await expect(decryptSecret(passEnv, cipher)).rejects.toThrow(/Token encrypt failed/);
  });

  it("throws a missing-key error when TOKEN_ENCRYPTION_KEY is empty", async () => {
    await expect(encryptSecret({ TOKEN_ENCRYPTION_KEY: "  " } as Env, "tok")).rejects.toThrow(TOKEN_KEY_MISSING);
    expect(encryptFailureDetail(new Error(TOKEN_KEY_MISSING))).toBe("missing");
    expect(isTokenEncryptError(new Error(TOKEN_KEY_MISSING))).toBe(true);
    expect(encryptFailureDetail(new Error("Token encrypt failed (OperationError)"))).toBe("OperationError");
  });

  it("leaves pending and empty values unencrypted", async () => {
    expect(await encryptSecret(env, "pending")).toBe("pending");
    expect(await encryptSecret(env, "")).toBe("");
  });

  it("round-trips credentials JSON used by adapters", async () => {
    const raw = await encryptCredentials(env, { webhookUrl: "https://discord.com/api/webhooks/1", channelId: "C1" });
    expect(raw).toBeTruthy();
    expect(await decryptCredentials(env, raw)).toEqual({
      webhookUrl: "https://discord.com/api/webhooks/1",
      channelId: "C1",
    });
    expect(await encryptCredentials(env, {})).toBeNull();
    expect(await decryptCredentials(env, null)).toBeUndefined();
  });
});
