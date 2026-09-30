import { Component } from "@angular/core";

@Component({
  standalone: true,
  template: `
    <article class="mx-auto max-w-3xl text-sm leading-relaxed text-muted">
      <p class="font-mono text-[11px] font-semibold uppercase tracking-widest text-cta">Connect</p>
      <h1 class="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink">Connect social accounts</h1>
      <p class="mt-4 text-base">Every channel belongs to one workspace. Add a channel in <strong class="text-ink">App → Accounts</strong>, then make a small test post before relying on a scheduled campaign.</p>

      <h2 class="mt-10 font-display text-xl font-bold text-ink">Choose the connection type</h2>
      <div class="mt-4 divide-y divide-line border-y border-line">
        <p class="py-4"><strong class="text-ink">OAuth:</strong> LinkedIn, X, Meta, Instagram, Threads, YouTube, Reddit, and Slack open the provider approval screen. Your instance operator must add that provider’s client ID and secret first.</p>
        <p class="py-4"><strong class="text-ink">Token or app password:</strong> some networks ask for credentials in Accounts. Use a dedicated app password or token when the provider offers one; never enter a personal password.</p>
      </div>

      <h2 class="mt-10 font-display text-xl font-bold text-ink">OAuth setup example</h2>
      <p class="mt-4">For an instance at <code>https://social.example.com</code> with an API at <code>https://api.example.com</code>, register this callback in the provider’s developer portal:</p>
      <pre class="mt-4 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-xs leading-7 text-zinc-100">https://api.example.com/v1/accounts/oauth/linkedin/callback</pre>
      <p class="mt-4">Replace <code>linkedin</code> with the network slug: <code>x</code>, <code>linkedin-page</code>, <code>facebook</code>, <code>instagram</code>, <code>threads</code>, <code>youtube</code>, or <code>slack</code>. Add the matching client ID and secret to the API Worker as secrets, then deploy again.</p>
      <pre class="mt-4 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-xs leading-7 text-zinc-100">pnpm --filter @duskly/api exec wrangler secret put LINKEDIN_CLIENT_ID --config wrangler.deploy.json
pnpm --filter @duskly/api exec wrangler secret put LINKEDIN_CLIENT_SECRET --config wrangler.deploy.json
pnpm deploy:api</pre>
      <p class="mt-4">Use the variable names in <code>apps/api/.dev.vars.example</code> for each provider. Leave unused provider credentials unset.</p>

      <h2 class="mt-10 font-display text-xl font-bold text-ink">Confirm it works</h2>
      <ol class="mt-4 list-decimal space-y-3 pl-5">
        <li>In Accounts, choose the network and complete its approval screen.</li>
        <li>Check that the new channel shows its handle and a connected state.</li>
        <li>Create a text-only draft, select only that channel, and publish it.</li>
        <li>Open Delivery updates and check the destination itself. A queued entry is not confirmation that the provider accepted the post.</li>
      </ol>
      <p class="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950"><strong>Reconnect instead of duplicating.</strong> When a provider token expires, reconnect the existing channel first. Before retrying a failed delivery, check the destination so a late provider response does not create a duplicate.</p>
    </article>
  `,
})
export class DocsAccountsPage {}

@Component({
  standalone: true,
  template: `
    <article class="mx-auto max-w-3xl text-sm leading-relaxed text-muted">
      <p class="font-mono text-[11px] font-semibold uppercase tracking-widest text-cta">Operate</p>
      <h1 class="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink">Updates, backups, and recovery</h1>
      <p class="mt-4 text-base">Your posts, schedules, connected accounts, and settings are stored in D1; media is stored in R2. Keep the two Worker secrets outside the repository.</p>

      <h2 class="mt-10 font-display text-xl font-bold text-ink">Before every update</h2>
      <ol class="mt-4 list-decimal space-y-3 pl-5">
        <li>Read the <a href="https://github.com/sarmaasis/duskly/blob/main/CHANGELOG.md" class="font-semibold text-ink underline decoration-cta underline-offset-4">changelog</a>.</li>
        <li>Export D1 and copy the media bucket with an S3-compatible backup tool.</li>
        <li>Keep <code>.env.deploy</code>, <code>BETTER_AUTH_SECRET</code>, and <code>TOKEN_ENCRYPTION_KEY</code> in secure storage.</li>
        <li>Pull the release, install locked dependencies, then deploy.</li>
      </ol>
      <pre class="mt-4 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-xs leading-7 text-zinc-100">pnpm --filter @duskly/api exec wrangler d1 export duskly --remote \\
  --output ../../duskly-backup.sql --config wrangler.deploy.json
git pull --ff-only
pnpm install --frozen-lockfile
pnpm deploy:release</pre>

      <h2 class="mt-10 font-display text-xl font-bold text-ink">What a rollback does</h2>
      <p class="mt-4">A Cloudflare Worker rollback restores code only. It does not undo D1 migrations, media writes, or changed secrets. Roll back both Workers to compatible versions and restore the database only after accounting for writes made since the backup.</p>

      <h2 class="mt-10 font-display text-xl font-bold text-ink">First-response checklist</h2>
      <ul class="mt-4 list-disc space-y-3 pl-5">
        <li><strong class="text-ink">Sign-in fails:</strong> verify the web and API domains are the configured HTTPS origins and share one registrable domain.</li>
        <li><strong class="text-ink">Post stays queued:</strong> inspect the Cron trigger, queue consumer, provider permissions, and Worker logs.</li>
        <li><strong class="text-ink">OAuth fails:</strong> compare the callback URL character-for-character with the provider portal and confirm the correct provider secrets are set.</li>
      </ul>
      <p class="mt-6">For the full list of known issues, read the <a href="https://github.com/sarmaasis/duskly/blob/main/docs/TROUBLESHOOTING.md" class="font-semibold text-ink underline decoration-cta underline-offset-4">troubleshooting guide</a>. Never include tokens, OTPs, database exports, or private post content in an issue.</p>
    </article>
  `,
})
export class DocsOperationsPage {}
