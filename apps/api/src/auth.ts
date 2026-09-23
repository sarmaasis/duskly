import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import { withCloudflare } from "better-auth-cloudflare";
import { drizzle } from "drizzle-orm/d1";
import { schema } from "./db/schema";
import type { Env } from "./env";

function isLocalAuthHost(env: Env) {
  const url = env.BETTER_AUTH_URL || "";
  return url.includes("localhost") || url.includes("127.0.0.1");
}

async function deliverOtp(env: Env, email: string, otp: string, type: string) {
  const send = env.EMAIL?.send;
  if (typeof send === "function") {
    try {
      await send({
        to: email,
        from: env.EMAIL_FROM,
        subject: `Your Duskly code: ${otp}`,
        text: `Your ${type} code is ${otp}. It expires in 10 minutes.`,
        html: `<p>Your ${type} code is <strong style="color:#FF5C33">${otp}</strong>.</p>`,
      });
      return;
    } catch (err) {
      console.error("[auth] EMAIL.send failed", err);
      if (env.DUSKLY_MODE === "cloud" && !isLocalAuthHost(env)) throw err;
    }
  } else if (env.DUSKLY_MODE === "cloud" && !isLocalAuthHost(env)) {
    throw new Error("EMAIL binding is not configured");
  }
  console.info(`[auth] OTP for ${email} (${type}): ${otp}`);
}

export function createAuth(env: Env, cf?: IncomingRequestCfProperties | null) {
  const db = drizzle(env.DB, { schema });
  const cfCtx = (cf ?? { colo: "LOCAL" }) as IncomingRequestCfProperties;
  const config = withCloudflare(
    {
      d1: { db, options: { schema } },
      kv: env.KV,
      cf: cfCtx,
      autoDetectIpAddress: false,
      geolocationTracking: false,
    },
    {
      baseURL: env.BETTER_AUTH_URL,
      secret: env.BETTER_AUTH_SECRET,
      trustedOrigins: [env.WEB_ORIGIN],
      emailAndPassword: { enabled: false },
      verification: { storeInDatabase: true },
      plugins: [
        emailOTP({
          otpLength: 6,
          expiresIn: 600,
          allowedAttempts: 5,
          sendVerificationOTP: async ({ email, otp, type }) => {
            await deliverOtp(env, email, otp, type);
          },
        }),
      ],
    },
  );
  const storage = config.secondaryStorage;
  if (storage) {
    config.secondaryStorage = {
      get: (key) => storage.get(key),
      set: (key, value, ttl) => storage.set(key, value, ttl),
      delete: (key) => storage.delete(key),
      getAndDelete: async (key) => {
        const value = await storage.get(key);
        if (value != null) await storage.delete(key);
        return value ?? null;
      },
    };
  }
  return betterAuth(config);
}
