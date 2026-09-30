# Duskly

An open-source social publishing workspace. Connect accounts, write and schedule posts, manage media, and follow up on delivery from one clear post list.

**[Self-host](docs/DEPLOY.md) · [User guide](docs/USAGE.md) · [Development](docs/DEVELOPMENT.md) · [Contributing](CONTRIBUTING.md)**

[![CI](https://github.com/sarmaasis/duskly/actions/workflows/ci.yml/badge.svg)](https://github.com/sarmaasis/duskly/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

Duskly runs in your Cloudflare account. Self-hosting has no Duskly subscription or hosted plan limits; Cloudflare and social provider charges can still apply. [Duskly Cloud](https://duskly.site) is the managed option.

## What you can do

- **Publish:** draft, attach media, choose connected accounts, and schedule from the three-step composer; switch between List, Calendar, and Week on Posts.
- **Organize:** filter by company, reuse media from Media library, and manage accounts and teammates.
- **Follow up:** review publishing problems in Delivery updates, conversations in Replies, and results in Analytics.
- **Automate:** use the smart agent, REST API, personal API tokens, and MCP.

Network capabilities vary. OAuth networks need your own developer apps and publishing permissions; connecting an account does not guarantee every media type or feature is supported.

## Status

Early software, before 1.0. Expect breaking changes, check [CHANGELOG.md](CHANGELOG.md) before updates, and back up your database and media. Self-hosting currently requires a Cloudflare account, email sending setup, and two subdomains of a domain you control.

## Run locally

Use **Node 24.15+ in the 24.x line** (see `.node-version`) and **pnpm 9.15.0**. The exact supported Node ranges are in `package.json`.

```sh
git clone https://github.com/sarmaasis/duskly.git
cd duskly
pnpm install --frozen-lockfile
cp apps/api/.dev.vars.example apps/api/.dev.vars
```

Replace both placeholder secrets in `.dev.vars` with separate values from `openssl rand -hex 32`. Then:

```sh
pnpm --filter @duskly/api db:migrate:local
pnpm dev:api
```

In another terminal:

```sh
pnpm dev:web
```

Open **http://localhost:4200**. For local OTP sign-in, read the code in the API terminal. Use the same `localhost` hostname as the example configuration. See [Development](docs/DEVELOPMENT.md) for checks and local service limitations.

## Deploy to your account

Follow [the deployment guide](docs/DEPLOY.md) to create Cloudflare resources and configure email. Then:

```sh
cp .env.deploy.example .env.deploy
# Fill in your resource IDs, origins, and verified email sender.
pnpm deploy:configure
# Set the two required Worker secrets as described in the guide.
pnpm deploy:dry-run
pnpm deploy:release
```

The release command checks types and tests, builds the frontend, applies remote migrations, and deploys API then web. Settings live in ignored files; the committed templates stay portable. GitHub deployment is opt-in and uses the same commands. A one-click deploy button would skip required email, secrets, and two-Worker setup, so use the guide.

## Documentation

| Goal | Guide |
| --- | --- |
| Write your first post and find your way around | [Using Duskly](docs/USAGE.md) |
| Create an instance, deploy, or upgrade | [Deployment](docs/DEPLOY.md) |
| Fix sign-in, routing, or publishing problems | [Troubleshooting](docs/TROUBLESHOOTING.md) |
| Work on the code and run checks | [Development](docs/DEVELOPMENT.md) |
| Understand components and data flow | [Architecture](docs/ARCHITECTURE.md) |
| Use REST or MCP | In-app `/docs/api` and `/docs/mcp` |

## Stack

Angular 22 SSR and static assets run in the web Worker. A Hono API Worker owns Better Auth email OTP, D1/Drizzle data, KV sessions, R2 media, Workers AI, and the Queue/Cron/Durable Object publishing pipeline. [Architecture](docs/ARCHITECTURE.md) explains the boundaries.

## Contribute and report issues

Read [CONTRIBUTING.md](CONTRIBUTING.md), include your checks, and sign commits with `git commit -s`. Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

Licensed under [Apache-2.0](LICENSE). CogSend's [navigation](https://github.com/deepakness/cogsend) and operator-focused documentation informed this redesign; Duskly retains its own implementation and product structure.
