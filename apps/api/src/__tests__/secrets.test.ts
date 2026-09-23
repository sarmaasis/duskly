import { describe, expect, it } from "vitest";
import { decryptCredentials, decryptSecret, encryptCredentials, encryptSecret } from "../lib/secrets";
import type { Env } from "../env";

const env = { TOKEN_ENCRYPTION_KEY: "a".repeat(64) } as Env;

describe("secret encryption", () => {
  it("round-trips a token", async () => {
    const cipher = await encryptSecret(env, "xoxb-secret");
    expect(cipher.startsWith("enc:v1:")).toBe(true);
    expect(await decryptSecret(env, cipher)).toBe("xoxb-secret");
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
