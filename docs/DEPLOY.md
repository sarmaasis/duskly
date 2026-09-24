# Deploy

Requires **Wrangler 4+** (pinned in the workspace) and **Angular 22** for the web Worker.

## One-click (Workers)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/sarmaasis/duskly)

The button asks you to create or pick D1 / KV / R2 / queues in the Cloudflare dashboard. It does not need resource IDs committed to git.

Repo: https://github.com/sarmaasis/duskly

## GitHub Actions (fork / self-host)

Create these once in **your** Cloudflare account (names can stay as in `apps/api/wrangler.jsonc`): D1 `duskly`, KV namespace, R2 `duskly-media`, queues `duskly-publish` and `duskly-publish-dlq`, Vectorize `duskly-posts`, Analytics Engine `duskly_metrics`, Email Sending.

Put the D1 database id and KV namespace id in GitHub Actions secrets or variables (`D1_DATABASE_ID`, `KV_NAMESPACE_ID`). Wrangler 4.136.3 does not expand `${VAR}` in `wrangler.jsonc`; the workflow replaces `${D1_DATABASE_ID}` and `${KV_NAMESPACE_ID}` at deploy time. `CLOUDFLARE_ACCOUNT_ID` is read from the environment (do not commit `account_id`).

GitHub secrets/vars the workflow needs: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, plus `D1_DATABASE_ID` and `KV_NAMESPACE_ID` (secret or variable). Optional for `wrangler.jsonc` vars only: `WEB_ORIGIN` and `API_ORIGIN`.

The web Worker SSR host allowlist follows `WEB_ORIGIN` at runtime (the origin hostname plus `www`/apex; always `localhost` and `127.0.0.1`). Unset or `https://duskly.site` allows `duskly.site` and `www.duskly.site`. Set `WEB_ORIGIN` to your site when self-hosting. The web Worker exposes `API_ORIGIN` to the browser at `/__api-config.js` (wrangler default `https://api.duskly.site`); `ng serve` falls back to `http://localhost:8787`.

Worker secrets are not in the workflow. Set them once with `wrangler secret bulk` (or `wrangler secret put`); they persist across `wrangler deploy`. Required: `BETTER_AUTH_SECRET`, `TOKEN_ENCRYPTION_KEY` (`openssl rand -hex 32`), `BETTER_AUTH_URL`, `WEB_ORIGIN`, `EMAIL_FROM`. Optional: OAuth client ids/secrets, Dodo billing keys, `DUSKLY_MODE` (`selfhost` default; set `cloud` only for paid hosted SaaS).

Instagram professional accounts that are **not** linked to Facebook use **Instagram Login**. Set Worker secrets `INSTAGRAM_APP_ID` and `INSTAGRAM_APP_SECRET` to the Instagram app id and secret from the Meta app’s **Instagram → API setup with Instagram login** (not `META_APP_ID` / `META_APP_SECRET`, not the Threads app id, not the user’s password). Paste `https://api.duskly.site/v1/accounts/oauth/instagram/callback` under **Instagram → API setup with Instagram login → business login OAuth redirect URIs**, not only under Facebook Login. If those two secrets are unset, Instagram connect keeps the Facebook Login + Page-linked fallback (`META_APP_ID` / `META_APP_SECRET`).
Instagram webhook **Callback URL** is `https://api.duskly.site/v1/instagram/webhook` (not the OAuth callback). Set Worker secret `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` to the same verify token you enter in the Meta webhook form — this is not `INSTAGRAM_APP_SECRET`.

Push to `main` or run **deploy** via `workflow_dispatch`. The workflow installs, applies D1 migrations, then deploys `duskly-api` and `duskly-web`.

Self-host stays free (`DUSKLY_MODE=selfhost`). Paid managed SaaS is Duskly Cloud on duskly.site (`DUSKLY_MODE=cloud`). Operator billing notes live in untracked `internal-docs/` (not in git).
