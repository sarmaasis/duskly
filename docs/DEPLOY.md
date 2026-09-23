# Deploy

Requires **Wrangler 4+** (pinned in the workspace) and **Angular 22** for the web Worker.

## One-click (Workers)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/sarmaasis/duskly)

Repo: https://github.com/sarmaasis/duskly

## Manual

1. Create Cloudflare resources named: D1 `duskly`, R2 `duskly-media`, queues `duskly-publish` and `duskly-publish-dlq`, Vectorize `duskly-posts`, Analytics Engine `duskly_metrics`, plus a KV namespace and Email Sending.
2. Do not commit production resource IDs or deployment-specific origins. Copy `apps/api/wrangler.jsonc` to ignored `apps/api/wrangler.production.jsonc`, replace the placeholder IDs there, and do the same for `apps/web/wrangler.production.jsonc` if `API_ORIGIN` differs.
3. Set secrets with Wrangler from `apps/api`, for example `pnpm exec wrangler secret put BETTER_AUTH_SECRET --config wrangler.production.jsonc`. Also set `TOKEN_ENCRYPTION_KEY` (`openssl rand -hex 32`), `EMAIL_FROM`, `BETTER_AUTH_URL`, `WEB_ORIGIN`, and any OAuth/billing secrets required by your deployment.
4. `pnpm --filter @duskly/api db:migrate:prod && pnpm --filter @duskly/api deploy:prod && pnpm --filter @duskly/web deploy:prod`  
   Workers: `duskly-api`, `duskly-web`.
5. Custom domains: duskly.site (web), api.duskly.site (api)

Self-host stays free (`DUSKLY_MODE=selfhost`). Paid managed SaaS is Duskly Cloud on duskly.site (`DUSKLY_MODE=cloud`). Operator billing notes live in untracked `internal-docs/` (not in git).
