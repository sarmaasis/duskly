import { Component, Input } from "@angular/core";
import { RouterLink } from "@angular/router";
import { MarketingFooter } from "../layout/marketing-footer";

@Component({
  standalone: true,
  selector: "dk-legal-shell",
  imports: [RouterLink, MarketingFooter],
  template: `
    <div class="min-h-dvh w-full overflow-x-hidden bg-[#fbfbfa] font-sans text-[#09090b] antialiased">
      <header class="sticky top-0 z-50 border-b border-[#e4e4e7] bg-[#fbfbfa]/90 backdrop-blur-md">
        <div class="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
          <a routerLink="/" class="font-display text-[17px] font-extrabold tracking-tight">Dus<span class="text-cta">kly</span></a>
          <div class="flex items-center gap-3 font-mono text-[12px]">
            <a routerLink="/privacy" class="text-[#52525b] hover:text-[#09090b]">Privacy</a>
            <a routerLink="/terms" class="text-[#52525b] hover:text-[#09090b]">Terms</a>
            <a routerLink="/data-deletion" class="text-[#52525b] hover:text-[#09090b]">Data deletion</a>
          </div>
        </div>
      </header>
      <main class="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <p class="font-mono text-[11px] font-semibold uppercase tracking-widest text-cta">{{ kicker }}</p>
        <h1 class="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{{ title }}</h1>
        <p class="mt-2 font-mono text-[11px] text-[#71717a]">Last updated September 23, 2026</p>
        <article class="mt-8 space-y-6 rounded-xl border border-[#e4e4e7] bg-white px-6 py-8 text-[14px] leading-relaxed text-[#52525b] shadow-[0_1px_3px_rgba(15,18,24,0.06)] sm:px-8">
          <ng-content />
        </article>
      </main>
      <dk-marketing-footer />
    </div>
  `,
})
export class LegalShell {
  @Input() kicker = "Legal";
  @Input() title = "";
}

@Component({
  standalone: true,
  imports: [LegalShell, RouterLink],
  template: `
    <dk-legal-shell kicker="Privacy" title="Privacy policy">
      <p>Duskly is a social scheduler. This page describes what we store when you use Duskly Cloud at duskly.site. If you self-host, this policy still describes the product; your own deployment holds the data.</p>
      <h2 class="font-display text-lg font-bold text-[#09090b]">What we store</h2>
      <ul class="list-disc space-y-1 pl-5">
        <li><span class="font-semibold text-[#09090b]">Account email</span> — used to sign you in (one-time codes) and send team invites.</li>
        <li><span class="font-semibold text-[#09090b]">Connected tokens</span> — OAuth access and refresh tokens, API keys, app passwords, bot tokens, or webhook URLs you connect. They are encrypted at rest with a workspace-scoped key and used only to publish the posts you schedule.</li>
        <li><span class="font-semibold text-[#09090b]">Posts</span> — draft and scheduled copy, first comments, schedule times, and publish status.</li>
        <li><span class="font-semibold text-[#09090b]">Media</span> — images and clips you upload or generate, stored so we can attach them when a slot fires.</li>
        <li><span class="font-semibold text-[#09090b]">Workspace metadata</span> — plan, teammates, companies (client groups), and channel handles.</li>
      </ul>
      <h2 class="font-display text-lg font-bold text-[#09090b]">How we use it</h2>
      <p>We use this data to run the scheduler: authenticate you, keep channels connected, send posts when due, and bill Cloud plans. We do not sell your posts, media, or connected-network tokens. We do not use connected-network content to train models.</p>
      <h2 class="font-display text-lg font-bold text-[#09090b]">Google, Meta, LinkedIn, Slack, Reddit, and X</h2>
      <p>When you connect a network, that provider shares an access token (and sometimes a refresh token or profile name) so Duskly can publish on your behalf. You can revoke that access in the provider’s security settings and by removing the channel in Duskly. For LinkedIn, Duskly requests profile identity and posting permissions such as <code class="rounded bg-[#f4f4f1] px-1 font-mono text-[12px]">openid</code>, <code class="rounded bg-[#f4f4f1] px-1 font-mono text-[12px]">profile</code>, and <code class="rounded bg-[#f4f4f1] px-1 font-mono text-[12px]">w_member_social</code>; LinkedIn Page publishing also uses <code class="rounded bg-[#f4f4f1] px-1 font-mono text-[12px]">w_organization_social</code>. We use LinkedIn tokens only to identify the connected member or organization and publish posts you schedule. LinkedIn’s privacy policy is at <a class="underline decoration-cta decoration-2 underline-offset-4" href="https://www.linkedin.com/legal/privacy-policy">linkedin.com/legal/privacy-policy</a>. The Slack bot posts to the public channel you picked before the bot is invited, which is why chat:write.public is requested. Google users can also revoke access at <a class="underline decoration-cta decoration-2 underline-offset-4" href="https://security.google.com/settings/security/permissions">Google security settings</a>. Google’s privacy policy is at <a class="underline decoration-cta decoration-2 underline-offset-4" href="https://policies.google.com/privacy">policies.google.com/privacy</a>.</p>
      <h2 class="font-display text-lg font-bold text-[#09090b]">Reviewer URLs</h2>
      <ul class="list-disc space-y-1 pl-5">
        <li>Instagram public media: <code class="rounded bg-[#f4f4f1] px-1 font-mono text-[12px]">GET https://api.duskly.site/v1/media/:id/public?exp&amp;sig</code></li>
        <li>Meta data-deletion callback: <code class="rounded bg-[#f4f4f1] px-1 font-mono text-[12px]">https://api.duskly.site/v1/meta/data-deletion</code></li>
        <li>Human data-deletion page: <code class="rounded bg-[#f4f4f1] px-1 font-mono text-[12px]">https://duskly.site/data-deletion</code></li>
      </ul>
      <h2 class="font-display text-lg font-bold text-[#09090b]">How to delete your data</h2>
      <p>Sign in, open <a routerLink="/app/accounts" class="font-semibold text-[#09090b] underline decoration-cta decoration-2 underline-offset-4">Accounts</a>, and remove a channel to drop its tokens. Delete posts from the calendar. To delete an entire Cloud account, email <a href="mailto:hello@duskly.site" class="font-semibold text-[#09090b]">hello&#64;duskly.site</a> from the same address you use to sign in. Meta also calls our data-deletion callback; see <a routerLink="/data-deletion" class="font-semibold text-[#09090b] underline decoration-cta decoration-2 underline-offset-4">Data deletion</a>.</p>
      <h2 class="font-display text-lg font-bold text-[#09090b]">Contact</h2>
      <p>Email <a href="mailto:hello@duskly.site">hello&#64;duskly.site</a>. We do not list a street address.</p>
    </dk-legal-shell>
  `,
})
export class PrivacyPage {}

@Component({
  standalone: true,
  imports: [LegalShell, RouterLink],
  template: `
    <dk-legal-shell kicker="Terms" title="Terms of use">
      <p>These terms cover Duskly Cloud at duskly.site and the open-source app when we host it for you. Self-host deployments are yours to run under the Apache-2.0 license.</p>
      <h2 class="font-display text-lg font-bold text-[#09090b]">The service</h2>
      <p>Duskly lets you draft posts, attach media, connect social and chat channels, and publish when a calendar slot is due. If a channel is missing credentials, the post stays queued. We do not mark it published.</p>
      <h2 class="font-display text-lg font-bold text-[#09090b]">Your account</h2>
      <p>You must be old enough to use the networks you connect. You are responsible for the content you schedule and for following each network’s rules. Do not use Duskly to spam, impersonate, or break the law.</p>
      <h2 class="font-display text-lg font-bold text-[#09090b]">Connected networks</h2>
      <p>Each platform (X, LinkedIn, Meta, Google, Reddit, Slack, and others) has its own terms. Connecting a channel means you authorize Duskly to call that API on your behalf for publishing. You can disconnect at any time on the Accounts page.</p>
      <h2 class="font-display text-lg font-bold text-[#09090b]">Cloud billing</h2>
      <p>Paid Cloud plans are billed through Dodo Payments. Limits on the plan page apply. Self-host has no Duskly fee.</p>
      <h2 class="font-display text-lg font-bold text-[#09090b]">Privacy</h2>
      <p>How we store account email, tokens, posts, and media is in the <a routerLink="/privacy" class="font-semibold text-[#09090b] underline decoration-cta decoration-2 underline-offset-4">privacy policy</a>.</p>
      <h2 class="font-display text-lg font-bold text-[#09090b]">Contact</h2>
      <p><a href="mailto:hello@duskly.site">hello&#64;duskly.site</a></p>
    </dk-legal-shell>
  `,
})
export class TermsPage {}

@Component({
  standalone: true,
  imports: [LegalShell, RouterLink],
  template: `
    <dk-legal-shell kicker="Data deletion" title="How to delete your data">
      <p>You control connected channels in the app. Meta and other reviewers can also hit our machine callback at <code class="rounded bg-[#f4f4f1] px-1 font-mono text-[12px]">https://api.duskly.site/v1/meta/data-deletion</code>.</p>
      <h2 class="font-display text-lg font-bold text-[#09090b]">Disconnect a channel</h2>
      <ol class="list-decimal space-y-2 pl-5">
        <li>Sign in at <a routerLink="/signin" class="font-semibold text-[#09090b] underline decoration-cta decoration-2 underline-offset-4">duskly.site/signin</a>.</li>
        <li>Open <a routerLink="/app/accounts" class="font-semibold text-[#09090b] underline decoration-cta decoration-2 underline-offset-4">Accounts</a>.</li>
        <li>Find the channel and click <span class="font-semibold text-[#09090b]">Remove</span>. That deletes the stored access and refresh tokens for that network.</li>
      </ol>
      <h2 class="font-display text-lg font-bold text-[#09090b]">Delete posts and media</h2>
      <p>Remove scheduled or published rows from the calendar, and delete uploads from the composer library. That drops post copy and stored files we hold for you.</p>
      <h2 class="font-display text-lg font-bold text-[#09090b]">Delete your Cloud account</h2>
      <p>Email <a href="mailto:hello@duskly.site" class="font-semibold text-[#09090b]">hello&#64;duskly.site</a> from the address you sign in with and ask us to delete the workspace. We will remove account email, tokens, posts, and media for that workspace.</p>
      <h2 class="font-display text-lg font-bold text-[#09090b]">Meta callback</h2>
      <p>When Facebook or Instagram send a signed deletion request, we verify it, delete stored Instagram, Threads, and Facebook tokens for that user when we can identify them, record the confirmation code, and return a status URL in the shape Meta requires. You can still use the steps above if you connected those networks yourself.</p>
    </dk-legal-shell>
  `,
})
export class DataDeletionPage {}
