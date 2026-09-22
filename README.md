# Sundraft

Open-source social media scheduler. Two Cloudflare Workers: Angular SSR frontend + Hono API. Auth is email OTP via Better Auth and Cloudflare Email Service.

**Domain:** register `sundraft.xyz` (~$0.95–$1.04 first year at Spaceship/Porkbun) or `sundraft.website` (~$0.92 at Loopia/Namecheap). Confirm availability at purchase time.

## Stack

| Layer | Service |
| --- | --- |
| Frontend Worker | Angular SSR (`platform: neutral`) + Workers Assets |
| Backend Worker | Hono on Workers |
| Auth | Better Auth `emailOTP` + `better-auth-cloudflare` |
| Mail | Cloudflare Email Service (`send_email` binding) |
| Data | D1 + Drizzle |
| Sessions / rate limit | KV |
| Media | R2 + Cloudflare Images |
| Publish pipeline | Queues + Workflows + Cron Triggers |
| Per-account lock | Durable Objects |
| Search | Vectorize (captions / post text) |
| Observability | Workers Analytics Engine + Workers Logs |
| AI assist | Workers AI (optional captions) |

UI language follows [SL Design System](https://github.com/sl-design-system/components) (clean surfaces, 8px grid, restrained chrome). Primary CTA is **sunset orange** `#FF5C33`.

## Repo

```
apps/api   backend Worker
apps/web   Angular SSR Worker
packages/shared
docs/
```

## Quick start

```bash
pnpm install
cp apps/api/.dev.vars.example apps/api/.dev.vars
pnpm --filter @sundraft/api db:migrate:local
pnpm dev:api    # :8787
pnpm dev:web    # :4200
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Apache-2.0
