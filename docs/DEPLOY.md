# Deploy

Requires **Wrangler 4+** (pinned in the workspace) and **Angular 22** for the web Worker.

## One-click (Workers)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/sarmaasis/duskly)

Repo: https://github.com/sarmaasis/duskly

## Manual

1. Create Cloudflare resources named: D1 `duskly`, R2 `duskly-media`, queues `duskly-publish` and `duskly-publish-dlq`, Vectorize `duskly-posts`, Analytics Engine `duskly_metrics`, plus a KV namespace and Email Sending. Existing deployments must create these Duskly-named resources (and paste their IDs into wrangler.jsonc) before deploy.
2. Paste IDs into apps/api/wrangler.jsonc.
3. `pnpm exec wrangler secret put BETTER_AUTH_SECRET` (from `apps/api`, Wrangler 4+)
4. pnpm db:migrate && pnpm deploy:api && pnpm deploy:web  
   Workers: `duskly-api`, `duskly-web`.
5. Custom domains: duskly.site (web), api.duskly.site (api)

Self-host stays free (`DUSKLY_MODE=selfhost`). Paid managed SaaS is Duskly Cloud on duskly.site (`DUSKLY_MODE=cloud`). Operator billing notes live in untracked `internal-docs/` (not in git).
