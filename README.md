# Cueora

Open-source social media scheduler. Self-host for free, or use **Cueora Cloud** and pay via [Dodo Payments](https://dodopayments.com).

**Name:** Cue + ora (now). Buy `cueora.xyz` or `cueora.website` (~$1 first year). Confirm at checkout. See [docs/BILLING.md](docs/BILLING.md).

Two Cloudflare Workers: Angular SSR + Hono API. Auth is email OTP via Better Auth and Cloudflare Email Service.

## Stack

| Layer | Service |
| --- | --- |
| Frontend Worker | Angular SSR (`platform: neutral`) + Workers Assets |
| Backend Worker | Hono on Workers |
| Auth | Better Auth `emailOTP` + `better-auth-cloudflare` |
| Mail | Cloudflare Email Service |
| Billing (cloud only) | Dodo Payments checkout + webhooks |
| Data | D1 + Drizzle |
| Sessions / rate limit | KV |
| Media | R2 + Cloudflare Images |
| Publish pipeline | Queues + Cron + Durable Objects |

Primary CTA: sunset orange `#FF5C33`.

## Quick start

```bash
pnpm install
cp apps/api/.dev.vars.example apps/api/.dev.vars
pnpm --filter @sundraft/api db:migrate:local
pnpm dev:api
pnpm dev:web
```

`CUEORA_MODE=selfhost` disables Dodo. Set `cloud` on the hosted workers.

Apache-2.0
