# Troubleshooting

[Documentation index](../README.md#documentation) · [Deployment](DEPLOY.md)

## Deployment stops with missing configuration

Copy `.env.deploy.example` to `.env.deploy`, fill every required setting, and run `pnpm deploy:configure`. D1 uses a UUID; KV uses a 32-character ID. Origins must be HTTPS without a path. Do not deploy the local `wrangler.jsonc` directly.

## Fork does not deploy automatically

This is intentional until setup is complete. Set the repository variable `DEPLOY_ENABLED=true` and the credentials and configuration in [Deployment](DEPLOY.md#github-actions-optional). Automatic deploys require successful push CI on `main`; PR runs do not deploy. Check any protection rules on the `production` environment.

## App calls the wrong API or sign-in does not persist

Fetch `https://YOUR_WEB_DOMAIN/__api-config.js`; it should identify your API. Check `.env.deploy`, then redeploy both Workers. Keep web and API on subdomains of the same domain. Confirm `WEB_ORIGIN` exactly matches the address in the browser and `BETTER_AUTH_URL` matches the API origin. If old secrets override variables, follow the configuration migration note in Deployment.

## OTP email never arrives

Check the API Worker logs, Email Service activation, and the verified domain in `EMAIL_FROM`. Production does not fall back to printing OTP codes. Locally, use the API terminal code and ensure `BETTER_AUTH_URL=http://localhost:8787`. Never post codes or auth secrets in an issue.

## Cloudflare says a binding or resource is missing

Confirm Wrangler is using the intended account. Check the two queues, R2 bucket, D1 database and KV namespace, plus account access to Email Service, AI, and Analytics Engine. The dry run verifies packaging, not remote resources. No Vectorize index or Images binding is needed by the current implementation.

## OAuth callback is rejected

Provider redirect URLs must exactly match `https://YOUR_API_DOMAIN/v1/accounts/oauth/NETWORK/callback`. Check the network slug, app credentials, app review status, and scopes. Instagram Login, Facebook Login, and Threads each have different app credentials and redirect settings.

## Post remains queued or failed

Check the API's Cron trigger, queue consumer, dead-letter queue, and Worker logs. Verify account tokens, network permissions, and media requirements. A healthy `/healthz` response only proves that HTTP handling works, not that the scheduler or provider is functioning. Check the destination before retrying to avoid accidental duplicates.

## UI is empty or workspace loading fails

Try **All companies**, then check the workspace-loading error and Retry. Verify `/healthz`, the runtime API config, and the session. A loading error is not proof that your posts were deleted.

## Report a bug

Include the commit/version, Node version, self-host or Cloud mode, page/action, and a redacted error. Add the results of `/healthz` and the expected API hostname when relevant. Exclude tokens, OTPs, database exports, `.dev.vars`, and private post content. Security reports follow [SECURITY.md](../SECURITY.md).
