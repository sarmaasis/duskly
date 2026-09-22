import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="mx-auto max-w-5xl">
      <div class="mx-auto max-w-lg rounded-xl border border-[#e8e8e3] bg-white p-8 text-center shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
        <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-cta">Billing</p>
        <h1 class="mt-2 font-display text-3xl font-bold tracking-tight dark:text-zinc-100">Checkout complete</h1>
        <p class="mt-2 text-sm text-[#63676c] dark:text-zinc-400">If payment succeeded, your workspace plan updates via the Dodo webhook. It can take a moment to reflect.</p>
        <a routerLink="/app" class="mt-6 inline-flex h-10 items-center rounded-full bg-cta px-5 text-sm font-semibold text-white hover:bg-cta-hover">Back to calendar</a>
      </div>
    </div>
  `,
})
export class BillingSuccessPage {}
