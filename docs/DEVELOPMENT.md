# Development

[Documentation index](../README.md#documentation)

## Local setup

Use Node 24.15+ (24.x) and pnpm 9.15.0. Install with `pnpm install --frozen-lockfile`, copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars`, and replace `BETTER_AUTH_SECRET` and `TOKEN_ENCRYPTION_KEY` with separate `openssl rand -hex 32` values.

```sh
pnpm --filter @duskly/api db:migrate:local
pnpm dev:api
```

In a second terminal, run `pnpm dev:web` and open `http://localhost:4200`. The API uses `http://localhost:8787`. Keep the origins in `.dev.vars` consistent. Local sign-in codes appear in the API terminal when the auth URL is localhost. Never use a localhost auth URL on a deployed Worker.

D1, KV, and R2 development data live under `.wrangler`; local migrations do not alter production. The email binding is simulated by default and logs messages locally; see [Cloudflare local email development](https://developers.cloudflare.com/email-service/local-development/sending/). Real OAuth, email delivery, AI, and scheduled publishing need the appropriate remote services and credentials. Browser tests mock the API so UI development does not require connecting social accounts or sending posts.

## Checks

| Command | Checks |
| --- | --- |
| `pnpm typecheck` | API and frontend TypeScript |
| `pnpm test` | Deployment configuration tests, API tests, SSR host checks |
| `pnpm build` | Production Angular templates, browser and SSR bundles |
| `pnpm e2e` | Browser flows against a dev server with mocked API responses |
| `pnpm deploy:dry-run` | Production Worker packaging using your `.env.deploy`; no upload |

Install Chromium once with `pnpm --filter @duskly/web exec playwright install chromium`. CI runs type checks, tests, a production build, browser tests, and DCO validation on pull requests. The current `lint` scripts are placeholders, not meaningful validation.

## UI boundaries

`layout/app-shell.ts` loads the workspace, theme, company context, and publishing alerts. `shell-navigation.ts` owns the shared route list, responsive top navigation, and More menu. `shell-notifications.ts` renders publishing issues in a native dialog; `shell-notices.ts` renders transient feedback. Keep page features in their route components and use Angular Router links for navigation so browser link behavior works.

Update `APP_NAV` once when adding an app destination. Routes themselves remain in `app.routes.ts`. Add browser coverage for route availability, keyboard interactions, and changes to navigation state.

## Deployment files

`wrangler.jsonc` templates contain JSON-compatible data for local development. Keep them valid JSON: the configuration script reads them without a JSONC parser. `.env.deploy` holds instance values; the deploy script regenerates ignored `wrangler.deploy.json` files. Do not edit generated files or commit credentials. See [Deployment](DEPLOY.md).

Follow [Contributing](../CONTRIBUTING.md) for commit sign-off and review expectations.
