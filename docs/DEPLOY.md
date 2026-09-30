# Self-host Duskly

[Documentation index](../README.md#documentation) · [Troubleshooting](TROUBLESHOOTING.md)

Duskly deploys **two Workers**: `duskly-web` for Angular and `duskly-api` for data, authentication, and publishing. These instructions deploy one instance per Cloudflare account using the resource names below. They do not overwrite secrets or provision resources automatically.

## 1. Before you start

- Node **24.15+ in the 24.x line**, pnpm **9.15.0**, and the Wrangler version installed by the lockfile.
- A Cloudflare account with Workers, D1, KV, R2, Queues, Analytics Engine, Workers AI, and Email Service access. Some services require activation or billing; self-host mode disables Duskly billing, not Cloudflare charges.
- A domain managed in Cloudflare with two available subdomains, for example `social.example.com` and `api.example.com`. Keep both under the same registrable domain so cookie-based sign-in works reliably. Unrelated `workers.dev` origins are not the supported browser-auth setup.
- A [verified email sender/domain in Cloudflare Email Service](https://developers.cloudflare.com/email-service/get-started/send-emails/). OTP sign-in depends on email in production. Email Routing alone is not a substitute for the sending service used by the `EMAIL` binding.

```sh
pnpm install --frozen-lockfile
pnpm --filter @duskly/api exec wrangler login
pnpm --filter @duskly/api exec wrangler whoami
```

Confirm that Wrangler selected the intended account. For unattended operation, provide `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in your environment. Scope the token to the intended account and the services you deploy.

## 2. Create the resources

Run once; reuse existing resources when upgrading. If a command says the resource exists, inspect it and reuse its ID rather than deleting it.

```sh
pnpm --filter @duskly/api exec wrangler d1 create duskly
pnpm --filter @duskly/api exec wrangler kv namespace create KV
pnpm --filter @duskly/api exec wrangler r2 bucket create duskly-media
pnpm --filter @duskly/api exec wrangler queues create duskly-publish
pnpm --filter @duskly/api exec wrangler queues create duskly-publish-dlq
```

Save the database UUID and namespace ID from the first two commands. Deployment configures the Queue consumer, one-minute Cron, SQLite-backed `SchedulerLock` Durable Object, `duskly_metrics` Analytics Engine dataset, and AI binding. Activate the relevant account services first. Vectorize and Images bindings are not required by the current implementation.

## 3. Configure your instance

```sh
cp .env.deploy.example .env.deploy
```

Fill in:

| Setting | Value |
| --- | --- |
| `D1_DATABASE_ID` | UUID of your `duskly` database |
| `KV_NAMESPACE_ID` | 32-character namespace ID |
| `WEB_ORIGIN` | `https://social.example.com` |
| `API_ORIGIN` | `https://api.example.com` |
| `EMAIL_FROM` | Verified sender, such as `Duskly <noreply@example.com>`; quote it in the env file |
| `DUSKLY_MODE` | `selfhost` (default); managed operators must explicitly use `cloud` |

Origins must be HTTPS origins without paths, query strings, or credentials.

```sh
pnpm deploy:configure
```

This validates settings and writes ignored `apps/api/wrangler.deploy.json` and `apps/web/wrangler.deploy.json`. It does not contact Cloudflare. It derives `BETTER_AUTH_URL` from `API_ORIGIN` and sets the same `WEB_ORIGIN` on both Workers. Environment variables take precedence over `.env.deploy`. The committed `wrangler.jsonc` files remain local-development templates; every supported deployment command regenerates production configuration from them.

## 4. Set stable secrets

Generate **two separate** values with `openssl rand -hex 32`. Keep them in a password manager, then enter each at its prompt:

```sh
pnpm --filter @duskly/api exec wrangler secret put BETTER_AUTH_SECRET --config wrangler.deploy.json
pnpm --filter @duskly/api exec wrangler secret put TOKEN_ENCRYPTION_KEY --config wrangler.deploy.json
```

Wrangler may offer to create the Worker on first use. The deployment script never generates, rotates, or uploads secrets. Losing or changing `TOKEN_ENCRYPTION_KEY` makes stored social credentials unreadable. Changing `BETTER_AUTH_SECRET` invalidates sessions.

`WEB_ORIGIN`, `BETTER_AUTH_URL`, `EMAIL_FROM`, and `DUSKLY_MODE` are configuration variables, not secrets in this flow. When migrating an older installation that stored these names as Worker secrets, remove those conflicting secret entries before deploying the generated configuration. Do not remove the two encryption/auth secrets above.

## 5. Check and deploy

```sh
pnpm deploy:dry-run
pnpm deploy:release
```

The dry run builds Angular and asks Wrangler to package both Workers without uploading. It does **not** verify remote resources, account permissions, or email delivery. Release runs type checks and unit tests, builds before changing remote state, applies D1 migrations, deploys API, and deploys web. Browser tests can be run separately with `pnpm e2e`; automatic GitHub deploys also require browser CI to pass.

In the Cloudflare dashboard, add custom domains on each Worker:

| Worker | Custom domain |
| --- | --- |
| `duskly-api` | `api.example.com` |
| `duskly-web` | `social.example.com` |

The script does not create DNS routes. Wait for the custom domains and certificates to become active.

## 6. Verify the running instance

```sh
curl --fail https://api.example.com/healthz
curl --fail https://social.example.com/__api-config.js
```

The first should report `ok: true`. The second must set `window.__API__` to **your** API origin. Then:

1. Open the web URL, request an OTP, and sign in.
2. Complete workspace onboarding.
3. Connect an account and save a draft.
4. Upload media and verify it appears in Library.
5. Schedule a test post and confirm the actual delivery, not just its presence on the calendar.

Duskly supports signup and multiple workspaces; it is not a single pre-provisioned admin instance. Consider who should be able to reach your deployment before sharing its URL.

## Connect social providers

Token-based connections are configured in Accounts. OAuth connections also need provider app credentials uploaded to the API Worker:

```sh
pnpm --filter @duskly/api exec wrangler secret put X_CLIENT_ID --config wrangler.deploy.json
pnpm --filter @duskly/api exec wrangler secret put X_CLIENT_SECRET --config wrangler.deploy.json
```

Use the matching names from `apps/api/.dev.vars.example` for LinkedIn, LinkedIn Pages, Meta, Instagram, Threads, Google/YouTube, Reddit, Slack, and Mastodon overrides. Leave credentials for unused providers unset. Do not upload example placeholder values.

Register this callback using your own API domain and the actual network slug:

```text
https://api.example.com/v1/accounts/oauth/{network}/callback
```

Examples: `linkedin`, `linkedin-page`, `instagram`, `threads`, `facebook`, `youtube`, `x`, `slack`.

Instagram Login uses `INSTAGRAM_APP_ID`/`INSTAGRAM_APP_SECRET` and its own Instagram Business Login **OAuth redirect URIs** settings. Facebook and the Page-linked Instagram fallback use `META_APP_ID`/`META_APP_SECRET`. Threads uses `THREADS_APP_ID`/`THREADS_APP_SECRET` and the Threads API redirect settings. These credentials are not interchangeable.

For Instagram webhooks, configure `https://api.example.com/v1/instagram/webhook` and set `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` to the same verification token in Meta. The data-deletion callback is `/v1/meta/data-deletion`; public legal pages are `/privacy`, `/terms`, and `/data-deletion` on your web domain. Review their content for your own instance.

## GitHub Actions (optional)

Provision the resources, secrets, custom domains, and email first. Fresh forks skip deploys until explicitly enabled.

Set these repository configuration values:

| Name | Store as |
| --- | --- |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | GitHub secrets |
| `D1_DATABASE_ID`, `KV_NAMESPACE_ID` | Secrets or variables |
| `WEB_ORIGIN`, `API_ORIGIN`, `EMAIL_FROM` | Secrets or variables |
| `DUSKLY_MODE` | Variable; omit for `selfhost`, set `cloud` for hosted billing |
| `DEPLOY_ENABLED` | **Repository variable** set to `true` |

The workflow uses the `production` environment, so you can configure GitHub environment protection rules. On a successful **push** CI run for `main` in this repository, deployment checks out the exact tested commit and runs the shared release command. Pull-request CI cannot trigger deployment. Manual dispatch checks types, unit tests, and builds for the selected ref, but does not run browser tests; choose a commit whose browser CI has passed.

## Update, back up, and roll back

Before an update, read the changelog and export the database:

```sh
pnpm --filter @duskly/api exec wrangler d1 export duskly --remote --output ../../duskly-backup.sql --config wrangler.deploy.json
```

Store the export outside Git in secure backup storage, copy R2 objects using your chosen S3-compatible backup tool, and retain the Worker secrets separately. Database exports do not include R2 files or secrets.

```sh
git pull --ff-only
pnpm install --frozen-lockfile
pnpm deploy:release
```

Keep `.env.deploy`; generated configs are rebuilt from updated templates. Re-run the smoke checks after every deployment.

Worker rollback in the Cloudflare dashboard restores code only. It does not revert D1 migrations or R2 changes. Roll back both Workers to compatible versions and assess schema compatibility before restoring data. Restore only when you have accounted for writes since the backup.

If API deployment succeeds and web deployment fails, fix the web build or configuration and run `pnpm deploy:web`; use `pnpm deploy:api` for an API-only fix and `pnpm db:migrate` for migrations alone. All three commands use the same validated configuration.
