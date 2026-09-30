import { Component, input } from "@angular/core";
import { RouterLink } from "@angular/router";

@Component({
  selector: "dk-posts-welcome",
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="rounded-2xl border border-line bg-white px-6 py-10 dark:border-zinc-800 dark:bg-zinc-900 sm:p-12" aria-label="Getting started">
      <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-cta">Let’s get you publishing</p>
      <h2 class="mt-3 max-w-lg font-display text-3xl font-bold tracking-tight">{{ connected() ? 'Your first post starts here.' : 'Connect an account. Make it yours.' }}</h2>
      <p class="mt-4 max-w-lg text-sm leading-7 text-muted dark:text-zinc-400">{{ connected() ? 'Your account is connected. Choose New post above to write a draft, then pick a time to publish.' : 'Add a social account so Duskly knows where to publish. You’ll use this account for drafts and scheduled posts.' }}</p>
      @if (!connected()) {
        <a routerLink="/app/accounts" class="mt-6 inline-flex h-10 items-center rounded-full bg-cta px-5 text-sm font-semibold text-white hover:bg-cta-hover">Connect your first account</a>
      }
      <ol class="mt-10 grid gap-6 border-t border-line pt-6 dark:border-zinc-800 sm:grid-cols-3">
        <li><span class="text-xs font-semibold text-muted dark:text-zinc-400">{{ connected() ? 'CONNECTED' : '01' }}</span><h3 class="mt-2 text-sm font-semibold">Connect an account</h3><p class="mt-1 text-xs leading-6 text-muted dark:text-zinc-400">Choose where you want to publish.</p></li>
        <li><span class="text-xs font-semibold text-muted dark:text-zinc-400">02</span><h3 class="mt-2 text-sm font-semibold">Write your post</h3><p class="mt-1 text-xs leading-6 text-muted dark:text-zinc-400">Start with words. Add media if you need it.</p></li>
        <li><span class="text-xs font-semibold text-muted dark:text-zinc-400">03</span><h3 class="mt-2 text-sm font-semibold">Choose a time</h3><p class="mt-1 text-xs leading-6 text-muted dark:text-zinc-400">Publish now or schedule for later.</p></li>
      </ol>
    </section>
  `,
})
export class PostsWelcome {
  readonly connected = input(false);
}
