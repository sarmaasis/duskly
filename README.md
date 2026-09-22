# Duskly

Open-source social media scheduler. **Self-host for free**, or use **paid managed SaaS** at [duskly.site](https://duskly.site) (Duskly Cloud, billed via [Dodo Payments](https://dodopayments.com)).

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/sarmaasis/duskly)

Two Cloudflare Workers: **Angular 22** SSR + Hono API, deployed with **Wrangler 4+**. Auth is email OTP via Better Auth and Cloudflare Email Service.

## Stack

| Layer | Service |
| --- | --- |
| Frontend Worker | Angular 22 SSR (`platform: neutral`) + Workers Assets |
| Backend Worker | Hono on Workers (Wrangler 4+) |
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
pnpm --filter @duskly/api db:migrate:local
pnpm dev:api
pnpm dev:web
```

`DUSKLY_MODE=selfhost` keeps billing off (free self-host). Set `cloud` on the hosted workers for Duskly Cloud at duskly.site.

See [docs/BILLING.md](docs/BILLING.md) and [docs/DEPLOY.md](docs/DEPLOY.md).

Apache-2.0
