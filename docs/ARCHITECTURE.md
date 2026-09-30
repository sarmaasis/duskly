# Architecture

[Documentation index](../README.md#documentation)

## Request path

The browser loads the Angular web Worker and `/__api-config.js`. That runtime script selects the API origin, so the same frontend build can serve different instances. Angular SSR derives its allowed hosts from the configured web origin.

The Hono API Worker handles Better Auth email OTP, workspace authorization, social connections, media, and post data. D1 stores relational records through Drizzle. KV backs sessions and related short-lived state; R2 stores media. Network credentials are encrypted using `TOKEN_ENCRYPTION_KEY`.

## Publishing

Cron runs every minute and claims due work into the publishing Queue. The Queue consumer obtains a `SchedulerLock` Durable Object lock per post/action, calls the network publishing implementation, and records delivery results. Failed queue messages retry and can enter the dead-letter queue. Analytics Engine receives publishing metrics; Workers AI supports assisted content features.

The current source does not use Vectorize or Cloudflare Images bindings. Adding them to deployment would impose unnecessary service setup.

## Frontend boundaries

- `app-shell.ts`: workspace loading, company context, theme persistence, and alert data.
- `shell-navigation.ts`: one navigation definition shared by desktop and mobile top navigation; secondary tools under More and Cloud-only billing visibility.
- `shell-notifications.ts`: publishing-issue dialog with native focus management.
- `shell-notices.ts`: transient success/error feedback.
- Route pages: Posts (list/calendar/week with first-use guidance), composer, accounts, media, and other product features.
- Composer components: write, channels, media, schedule, and additional options share the existing compose context.

## Deployment boundaries

Committed Wrangler templates are local defaults. `scripts/deploy.mjs` validates instance configuration, generates ignored configs, and runs both Worker deployments. GitHub Actions uses this same entry point. Secrets remain in Cloudflare; the script never rotates encryption keys. Runtime self-host mode bypasses hosted billing limits; Cloud mode is an explicit operator setting.

See [Deployment](DEPLOY.md) for service requirements and [Development](DEVELOPMENT.md) for verification.
