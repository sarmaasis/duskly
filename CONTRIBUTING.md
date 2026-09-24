# Contributing

Thanks for helping improve Duskly. Small, focused PRs are easiest to review.

## Workflow

1. Fork the repo and branch from `main` (`feat/...`, `fix/...`, `docs/...`).
2. Install dependencies with `pnpm install`.
3. Make the smallest change that solves the issue.
4. Add or update tests for behavior changes.
5. Sign every commit with DCO: `git commit -s`.
6. Open a PR with a clear summary and test plan.

## Local Checks

Run these before opening a PR:

```bash
pnpm typecheck
pnpm test
pnpm e2e
```

For local development:

```bash
cp apps/api/.dev.vars.example apps/api/.dev.vars
pnpm --filter @duskly/api db:migrate:local
pnpm dev:api
pnpm dev:web
```

Install the Playwright browser once before running e2e locally:

```bash
pnpm --filter @duskly/web exec playwright install chromium
```

## Rules

- API changes need a route test.
- Do not commit secrets or `.dev.vars`.
- UI: SL Design System density; primary buttons use `--color-cta`.
- One concern per PR.
- Public docs should not reference untracked `internal-docs/`.

## Developer Certificate of Origin

Duskly uses the Developer Certificate of Origin 1.1. By signing off, you certify that you have the right to contribute the work under this project license.

Use:

```bash
git commit -s
```
