# Self-Host Deployment

Duskly runs as two Cloudflare Workers:

- `duskly-api`: Hono API, Better Auth, D1, KV, R2, Queues, Cron, Durable Objects, Email.
- `duskly-web`: Angular SSR Worker plus static assets.

Self-host mode is free and disables hosted billing behavior with `DUSKLY_MODE=selfhost`.

## Requirements

- Node.js 20 or newer.
- pnpm 9.15 or newer.
- A Cloudflare account with Workers enabled.
- Wrangler 4, pinned in this repo.
- A domain or subdomain for the web app and one for the API.

Install locally:

```bash
pnpm install
```

## Local Development

Copy local API secrets:

```bash
cp apps/api/.dev.vars.example apps/api/.dev.vars
```

Apply local D1 migrations:

```bash
pnpm --filter @duskly/api db:migrate:local
```

Run both workers:

```bash
pnpm dev:api
pnpm dev:web
```

By default, the web app calls `http://localhost:8787`.

## Cloudflare Resources

Create these once in your Cloudflare account:

| Resource | Suggested name | Binding |
| --- | --- | --- |
| D1 database | `duskly` | `DB` |
| KV namespace | `duskly` | `KV` |
| R2 bucket | `duskly-media` | `MEDIA` |
| Queue | `duskly-publish` | `PUBLISH` |
| Dead-letter queue | `duskly-publish-dlq` | configured on queue |
| Vectorize index | `duskly-posts` | `SEARCH` |
| Analytics Engine dataset | `duskly_metrics` | `METRICS` |
| Workers AI | account binding | `AI` |
| Cloudflare Images | account binding | `IMAGES` |
| Email Sending | verified sender/domain | `EMAIL` |

`apps/api/wrangler.jsonc` contains placeholder IDs for D1 and KV. The GitHub workflow replaces them from secrets or variables before deploy.

## Required Secrets

Set Worker secrets on `duskly-api`:

```bash
pnpm --filter @duskly/api exec wrangler secret put BETTER_AUTH_SECRET
pnpm --filter @duskly/api exec wrangler secret put TOKEN_ENCRYPTION_KEY
pnpm --filter @duskly/api exec wrangler secret put BETTER_AUTH_URL
pnpm --filter @duskly/api exec wrangler secret put WEB_ORIGIN
pnpm --filter @duskly/api exec wrangler secret put EMAIL_FROM
```

Use a stable 32-byte token key:

```bash
openssl rand -hex 32
```

Do not rotate `TOKEN_ENCRYPTION_KEY` unless you have a migration plan for encrypted social tokens.

Common optional secrets:

| Secret | Used for |
| --- | --- |
| `DUSKLY_MODE` | `selfhost` or `cloud`; omit or set `selfhost` for self-hosting |
| `API_ORIGIN` | Web Worker runtime API URL |
| `X_CLIENT_ID`, `X_CLIENT_SECRET` | X OAuth |
| `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | LinkedIn OAuth |
| `META_APP_ID`, `META_APP_SECRET` | Facebook Login, Facebook Pages, Page-linked Instagram fallback |
| `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` | Direct Instagram Business Login |
| `THREADS_APP_ID`, `THREADS_APP_SECRET` | Direct Threads Login and publishing |
| `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` | Instagram webhook verification |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | YouTube upload |
| `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` | Reddit OAuth |
| `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` | Slack OAuth |
| `DODO_*` | Hosted cloud billing only |

## OAuth Callback URLs

Use your API origin in these callback URLs:

```text
https://api.example.com/v1/accounts/oauth/{network}/callback
```

Examples:

```text
https://api.example.com/v1/accounts/oauth/instagram/callback
https://api.example.com/v1/accounts/oauth/facebook/callback
https://api.example.com/v1/accounts/oauth/linkedin/callback
https://api.example.com/v1/accounts/oauth/slack/callback
```

Production Duskly Cloud examples:

```text
https://api.duskly.site/v1/accounts/oauth/instagram/callback
https://api.duskly.site/v1/accounts/oauth/facebook/callback
https://api.duskly.site/v1/accounts/oauth/linkedin/callback
https://api.duskly.site/v1/accounts/oauth/slack/callback
```

Instagram professional accounts that are not linked to Facebook use Instagram Login. Set `INSTAGRAM_APP_ID` and `INSTAGRAM_APP_SECRET` from the Meta app's Instagram API setup. Add the Instagram callback under Instagram API / Business Login OAuth redirect URIs, not only under Facebook Login.

Threads uses the Threads API, not Facebook Login or Instagram Login. Set `THREADS_APP_ID` and `THREADS_APP_SECRET` from Meta's Threads API setup. Add this redirect callback URL under Threads API settings:

```text
https://api.example.com/v1/accounts/oauth/threads/callback
```

For the production Duskly Cloud app:

```text
https://api.duskly.site/v1/accounts/oauth/threads/callback
```

Instagram webhook callback:

```text
https://api.example.com/v1/instagram/webhook
```

Production Duskly Cloud webhook:

```text
https://api.duskly.site/v1/instagram/webhook
```

Set `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` to the same value entered in Meta's webhook form.

## GitHub Actions Deploy

Set these GitHub repository secrets or variables:

| Name | Required | Notes |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | yes | Token with Workers, D1, KV, R2, Queues deploy permissions |
| `CLOUDFLARE_ACCOUNT_ID` | yes | Cloudflare account id |
| `D1_DATABASE_ID` | yes | D1 database id |
| `KV_NAMESPACE_ID` | yes | KV namespace id |
| `WEB_ORIGIN` | recommended | e.g. `https://duskly.example.com` |
| `API_ORIGIN` | recommended | e.g. `https://api.example.com` |

Pushes to `main` run the `ci` workflow first. The automatic `deploy` workflow starts only after `ci` completes successfully, including browser e2e tests. If typecheck, unit tests, or e2e fail, deployment does not run. Deploy checks out the exact commit that passed CI.

You can still run the `deploy` workflow manually from GitHub Actions for an intentional emergency or rollback deploy.

The workflow:

1. Installs with the lockfile.
2. Substitutes D1/KV IDs into Wrangler configs.
3. Applies D1 migrations.
4. Deploys the API Worker.
5. Builds and deploys the web Worker.

## Manual Deploy

Substitute real D1/KV IDs in a local copy of `apps/api/wrangler.jsonc`, then:

```bash
pnpm --filter @duskly/api db:migrate
pnpm deploy:api
pnpm deploy:web
```

Set routes/custom domains in the Cloudflare dashboard for both Workers.

## Smoke Checks

After deploy:

```bash
curl https://api.example.com/v1/health
curl https://duskly.example.com/__api-config.js
```

Then open the web app and verify:

- Sign-in email OTP sends.
- A workspace loads after sign-in.
- Accounts page shows configured networks.
- Composer can create a draft.
- Calendar shows the draft.
- Media upload returns a library item.

## Test Before Deploying

Run static and unit checks:

```bash
pnpm typecheck
pnpm test
```

Run browser e2e checks:

```bash
pnpm --filter @duskly/web exec playwright install chromium
pnpm e2e
```

The e2e suite starts the Angular dev server and mocks API responses. It covers public pages, docs, free tools, OTP sign-in, app shell navigation, composer scheduling, accounts, settings, team, agent, media, inbox, analytics, billing, and public previews.

## Upgrades

For self-hosted upgrades:

1. Pull the new code.
2. Read `CHANGELOG.md`.
3. Run `pnpm install --frozen-lockfile`.
4. Run `pnpm typecheck` and `pnpm test`.
5. Apply D1 migrations.
6. Deploy API, then web.
7. Run smoke checks.

## Backups

Back up before major upgrades:

- Export D1.
- Keep a copy of Worker secrets in your own password manager.
- Back up R2 media if posts rely on attached assets.
- Do not lose `TOKEN_ENCRYPTION_KEY`; encrypted social tokens cannot be decrypted without it.

## Troubleshooting

### Web app points to the wrong API

Check `API_ORIGIN` in `apps/web/wrangler.jsonc` or GitHub Actions variables. The browser reads it from `/__api-config.js`.

### Sign-in email does not arrive

Check Cloudflare Email Sending setup, `EMAIL_FROM`, and Worker logs for the API Worker.

### OAuth callback fails

The callback URL in the provider must exactly match:

```text
https://api.example.com/v1/accounts/oauth/{network}/callback
```

For Instagram Login, use `INSTAGRAM_APP_ID` and `INSTAGRAM_APP_SECRET`, and add the callback in the Instagram API setup.

### Posts stay queued

Queued is safer than fake success. Check:

- The connected account token is active.
- The provider app has publish permission.
- The post has required media for that network.
- The `duskly-publish` queue and consumer are deployed.
- API Worker logs for the destination-specific error.

### API typecheck or tests fail

Do not deploy from a red local state. Run:

```bash
pnpm typecheck
pnpm test
```

Fix those first, then deploy.
