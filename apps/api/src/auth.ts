import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { emailOTP } from "better-auth/plugins";
import { withCloudflare } from "better-auth-cloudflare";
import { drizzle } from "drizzle-orm/d1";
import { schema } from "./db/schema";
import type { Env } from "./env";

export function createAuth(env: Env, cf?: IncomingRequestCfProperties | null) {
  const db = drizzle(env.DB, { schema });
  const cfCtx = (cf ?? { colo: "LOCAL" }) as IncomingRequestCfProperties;
  return betterAuth(
    withCloudflare(
      {
        d1: env.DB,
        kv: env.KV,
        cf: cfCtx,
        autoDetectIpAddress: false,
        geolocationTracking: false,
      },
      {
        baseURL: env.BETTER_AUTH_URL,
        secret: env.BETTER_AUTH_SECRET,
        trustedOrigins: [env.WEB_ORIGIN],
        database: drizzleAdapter(db, { provider: "sqlite", schema }),
        secondaryStorage: {
          get: (key) => env.KV.get(key),
          set: (key, value, ttl) =>
            env.KV.put(key, value, ttl ? { expirationTtl: Math.max(ttl, 60) } : undefined),
          delete: (key) => env.KV.delete(key),
        },
        emailAndPassword: { enabled: false },
        plugins: [
          emailOTP({
            otpLength: 6,
            expiresIn: 600,
            allowedAttempts: 5,
            sendVerificationOTP: async ({ email, otp, type }) => {
              await env.EMAIL.send({
                to: email,
                from: env.EMAIL_FROM,
                subject: `Your Duskly code: ${otp}`,
                text: `Your ${type} code is ${otp}. It expires in 10 minutes.`,
                html: `<p>Your ${type} code is <strong style="color:#FF5C33">${otp}</strong>.</p>`,
              });
            },
          }),
        ],
      },
    ),
  );
}
