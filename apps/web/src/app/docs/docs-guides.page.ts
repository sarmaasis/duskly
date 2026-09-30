import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <article class="mx-auto max-w-3xl text-sm leading-relaxed text-muted">
      <p class="font-mono text-[11px] font-semibold uppercase tracking-widest text-cta">Get started</p>
      <h1 class="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink">Your first post</h1>
      <p class="mt-4 text-base">Connect an account, write a draft, and choose when it goes live.</p>
      <ol class="mt-8 list-decimal space-y-5 pl-5">
        <li><strong class="text-ink">Sign in and create your workspace.</strong> Use the email code and complete onboarding.</li>
        <li><strong class="text-ink">Connect a channel in Accounts.</strong> OAuth networks need an app configured by your instance operator. Token connections ask for the network's token or app password.</li>
        <li><strong class="text-ink">Select New post.</strong> Write your caption, choose destination accounts, and attach media. Check the requirements for each network.</li>
        <li><strong class="text-ink">Save a draft or schedule.</strong> Follow Write, Accounts, and Schedule. Review the selected accounts and date/time before confirming.</li>
        <li><strong class="text-ink">Follow delivery in Posts.</strong> Open Delivery updates for failed or queued posts. A scheduled entry does not yet mean the network accepted the post.</li>
      </ol>
      <h2 class="mt-10 font-display text-xl font-bold text-ink">A place for each task</h2>
      <div class="mt-4 divide-y divide-line border-y border-line">
        <p class="py-4"><strong class="text-ink">Everyday navigation:</strong> Posts, Accounts, and Analytics. New post opens the three-step composer.</p>
        <p class="py-4"><strong class="text-ink">More:</strong> Media library, Replies, AI assistant, Settings, Team, and Billing for Cloud workspaces.</p>
        <p class="py-4"><strong class="text-ink">On mobile:</strong> The same top navigation stays available. More contains secondary tools, theme, sign-out, and help.</p>
      </div>
      <h2 class="mt-10 font-display text-xl font-bold text-ink">Companies and delivery updates</h2>
      <p class="mt-4">The company filter appears after you create a company. It filters your current workspace; it does not switch your user. If content seems missing, try All companies. Delivery updates show publishing problems, while Replies is for conversations and replies.</p>
      <div class="mt-8 flex flex-wrap gap-5 font-semibold text-ink">
        <a routerLink="/app/accounts" class="underline decoration-cta underline-offset-4">Connect an account</a>
        <a routerLink="/docs/self-host" class="underline decoration-cta underline-offset-4">Host your own instance</a>
        <a routerLink="/docs/api" class="underline decoration-cta underline-offset-4">Automate with the API</a>
      </div>
    </article>
  `,
})
export class DocsGettingStartedPage {}

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <article class="mx-auto max-w-3xl text-sm leading-relaxed text-muted">
      <p class="font-mono text-[11px] font-semibold uppercase tracking-widest text-cta">Run Duskly</p>
      <h1 class="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink">Self-host on Cloudflare</h1>
      <p class="mt-4 text-base">Your accounts, posts, and media live in your Cloudflare account. Self-host mode removes Duskly subscription limits; infrastructure and provider charges can still apply.</p>
      <h2 class="mt-10 font-display text-xl font-bold text-ink">Before you start</h2>
      <ul class="mt-4 list-disc space-y-2 pl-5">
        <li>Node 24.15+ in the 24.x line and pnpm 9.15.0.</li>
        <li>Cloudflare Workers, D1, KV, R2, Queues, Analytics Engine, Workers AI, and Email Service access.</li>
        <li>Two subdomains of a domain you control: one for the web app and one for the API.</li>
        <li>A verified email sender for production sign-in codes.</li>
      </ul>
      <h2 class="mt-10 font-display text-xl font-bold text-ink">Install in four steps</h2>
      <ol class="mt-4 list-decimal space-y-4 pl-5">
        <li>Clone the repository, install the locked dependencies, and create the Cloudflare resources in the deployment guide.</li>
        <li>Copy <code>.env.deploy.example</code> to <code>.env.deploy</code>. Fill in your database and KV IDs, origins, and verified sender.</li>
        <li>Run <code>pnpm deploy:configure</code> and set the two stable API Worker secrets: <code>BETTER_AUTH_SECRET</code> and <code>TOKEN_ENCRYPTION_KEY</code>.</li>
        <li>Run the packaging check and release below, then attach each custom domain in Cloudflare.</li>
      </ol>
      <pre class="mt-6 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-xs leading-7 text-zinc-100">pnpm deploy:dry-run
pnpm deploy:release</pre>
      <p class="mt-4">A dry run verifies packaging without uploading. Release checks types and tests, builds the frontend, migrates D1, and deploys both Workers. It does not create DNS routes or configure provider apps.</p>
      <a href="https://github.com/sarmaasis/duskly/blob/main/docs/DEPLOY.md" class="mt-6 inline-block font-semibold text-ink underline decoration-cta underline-offset-4">Read the complete deployment guide</a>
      <h2 class="mt-10 font-display text-xl font-bold text-ink">Verify and maintain</h2>
      <p class="mt-4">Check <code>/healthz</code> on your API and <code>/__api-config.js</code> on your web app. Sign in, connect an account, and confirm an actual test post publishes. Back up D1, R2, and your secrets before upgrades. Worker rollback restores code, not database migrations.</p>
      <p class="mt-4">GitHub deployment is opt-in through the repository variable <code>DEPLOY_ENABLED=true</code>, after credentials and resources are ready. It uses the same release command and waits for successful push CI.</p>
      <div class="mt-8 flex flex-wrap gap-5 font-semibold text-ink">
        <a href="https://github.com/sarmaasis/duskly/blob/main/docs/TROUBLESHOOTING.md" class="underline decoration-cta underline-offset-4">Troubleshooting</a>
        <a routerLink="/docs/getting-started" class="underline decoration-cta underline-offset-4">Write your first post</a>
      </div>
    </article>
  `,
})
export class DocsSelfHostPage {}
