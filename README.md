# Duskly

Open-source social media scheduler. **Self-host for free**, or use **paid managed SaaS** at [duskly.site](https://duskly.site) (Duskly Cloud, billed via [Dodo Payments](https://dodopayments.com)).

[![CI](https://github.com/sarmaasis/duskly/actions/workflows/ci.yml/badge.svg)](https://github.com/sarmaasis/duskly/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/sarmaasis/duskly)

Two Cloudflare Workers: **Angular 22** SSR + Hono API, deployed with **Wrangler 4+**. Auth is email OTP via Better Auth and Cloudflare Email Service.

## Project Status

Duskly is early software. The public repo is intended for self-hosters, contributors, and operators who are comfortable with Cloudflare Workers. Breaking changes can still happen before a stable 1.0 release.

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

Run checks:

```bash
pnpm typecheck
pnpm test
pnpm e2e
```

`DUSKLY_MODE=selfhost` keeps billing off (free self-host). Set `cloud` on the hosted workers for Duskly Cloud at duskly.site.

OAuth callbacks (Cloud): `https://api.duskly.site/v1/accounts/oauth/{network}/callback`. Privacy / terms / data deletion: `/privacy`, `/terms`, `/data-deletion` on duskly.site.

See [docs/DEPLOY.md](docs/DEPLOY.md). Cloud billing setup is kept in untracked internal docs for operators.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md), sign commits with `git commit -s`, and keep PRs focused. CI runs type checks, tests, and DCO validation.

## Security

Please do not open public issues for vulnerabilities. See [SECURITY.md](SECURITY.md).

Apache-2.0
