import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import { withCloudflare } from "better-auth-cloudflare";
import { drizzle } from "drizzle-orm/d1";
import { schema } from "./db/schema";
import { emailSendErrorFields, parseEmailSender, sendViaEmailBinding } from "./lib/email-sender";
import type { Env } from "./env";

type SecondaryStorage = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  getAndDelete?: (key: string) => Promise<string | null>;
};

function isLocalAuthHost(env: Env) {
  const url = env.BETTER_AUTH_URL || "";
  return url.includes("localhost") || url.includes("127.0.0.1");
}

async function deliverOtp(env: Env, email: string, otp: string, type: string) {
  const mailer = env.EMAIL;
  const localAuth = isLocalAuthHost(env);
  if (mailer && typeof mailer.send === "function") {
    try {
      await sendViaEmailBinding(mailer, {
        to: email,
        from: parseEmailSender(env.EMAIL_FROM),
        subject: `Your Duskly code: ${otp}`,
        text: `Your ${type} code is ${otp}. It expires in 10 minutes.`,
        html: `<p>Your ${type} code is <strong style="color:#FF5C33">${otp}</strong>.</p>`,
      });
      return;
    } catch (err) {
      const { name, message, code } = emailSendErrorFields(err);
      console.error("[auth] EMAIL.send failed", name, message, code);
      if (!localAuth) throw err;
    }
  } else if (!localAuth) {
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
      kv: env.KV as never,
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
  ) as ReturnType<typeof withCloudflare> & { secondaryStorage?: SecondaryStorage };
  const storage = config.secondaryStorage;
  if (storage) {
    config.secondaryStorage = {
      get: (key: string) => storage.get(key),
      set: (key: string, value: string, ttl?: number) => storage.set(key, value, ttl),
      delete: (key: string) => storage.delete(key),
      getAndDelete: async (key: string) => {
        const value = await storage.get(key);
        if (value != null) await storage.delete(key);
        return value ?? null;
      },
    };
  }
  return betterAuth(config as never);
}
