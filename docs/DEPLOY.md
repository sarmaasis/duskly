# Deploy

1. Create D1, KV, R2, Queues, Vectorize, Email Sending.
2. Paste IDs into apps/api/wrangler.jsonc.
3. wrangler secret put BETTER_AUTH_SECRET
4. pnpm db:migrate && pnpm deploy:api && pnpm deploy:web
5. Custom domains: sundraft.xyz (web), api.sundraft.xyz (api)
