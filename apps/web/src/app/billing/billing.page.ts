import { Component, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { api } from "../lib/api";

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="mx-auto max-w-5xl">
      <div class="mb-6">
        <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-cta">Workspace</p>
        <h1 class="mt-1 font-display text-3xl font-bold tracking-tight dark:text-zinc-50">Billing</h1>
        <p class="mt-1 max-w-xl text-sm text-[#63676c] dark:text-zinc-400">Start a Dodo Payments checkout for your Cloud plan. Self-host skips billing.</p>
      </div>

      @if (msg()) {
        <p class="mb-4 rounded-xl border border-[#e8e8e3] bg-white px-4 py-3 text-[13px] shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900" [class.text-red-600]="err()" [class.text-[#365314]]="!err()">{{ msg() }}</p>
      }

      <section class="mb-4 rounded-xl border border-[#e8e8e3] bg-white p-4 shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
        <div class="mb-4 inline-flex rounded-lg border border-[#e8e8e3] bg-[#f7f7f4] p-0.5 dark:border-zinc-700 dark:bg-zinc-800">
          <button type="button" (click)="interval = 'month'" class="rounded-md px-3 py-1.5 text-xs font-semibold" [class.bg-[#121417]]="interval==='month'" [class.text-white]="interval==='month'" [class.text-[#52525b]]="interval!=='month'" [class.dark:bg-zinc-100]="interval==='month'" [class.dark:text-zinc-900]="interval==='month'">Monthly</button>
          <button type="button" (click)="interval = 'year'" class="rounded-md px-3 py-1.5 text-xs font-semibold" [class.bg-[#121417]]="interval==='year'" [class.text-white]="interval==='year'" [class.text-[#52525b]]="interval!=='year'" [class.dark:bg-zinc-100]="interval==='year'" [class.dark:text-zinc-900]="interval==='year'">Yearly</button>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          @for (p of plans; track p.id) {
            <button
              type="button"
              (click)="checkout(p.id)"
              class="rounded-xl border border-[#e8e8e3] p-4 text-left transition hover:border-[#121417] dark:border-zinc-700 dark:hover:border-zinc-400"
            >
              <p class="font-display text-lg font-bold dark:text-zinc-100">{{ p.name }}</p>
              <p class="mt-1 font-mono text-2xl font-extrabold dark:text-zinc-100">{{ '$' + (interval === 'year' ? p.yearly : p.monthly) }}</p>
              <p class="mt-2 text-[12px] text-[#63676c] dark:text-zinc-400">{{ p.blurb }}</p>
              <span class="mt-3 inline-flex h-9 items-center rounded-full bg-cta px-4 text-xs font-semibold text-white">Checkout</span>
            </button>
          }
        </div>
      </section>
      <p class="text-[12px] text-[#63676c] dark:text-zinc-400">Need plan details? <a routerLink="/pricing" class="font-semibold text-[#121417] underline decoration-cta underline-offset-2 dark:text-zinc-100">View pricing</a></p>
    </div>
  `,
})
export class BillingPage implements OnInit {
  workspaceId = "";
  interval: "month" | "year" = "month";
  msg = signal("");
  err = signal(false);
  plans = [
    { id: "standard", name: "Standard", monthly: 29, yearly: 290, blurb: "5 channels · solo" },
    { id: "team", name: "Team", monthly: 39, yearly: 390, blurb: "10 channels · team seats" },
    { id: "pro", name: "Pro", monthly: 49, yearly: 490, blurb: "30 channels · heavier AI" },
    { id: "ultimate", name: "Ultimate", monthly: 99, yearly: 990, blurb: "100 channels · agencies" },
  ];

  async ngOnInit() {
    try {
      const me = await api<{ workspace: { id: string } }>("/v1/workspaces/me");
      this.workspaceId = me.workspace.id;
    } catch {
      this.fail("Sign in to start checkout.");
    }
  }

  async checkout(plan: string) {
    try {
      const r = await api<{ checkout_url: string }>("/v1/billing/checkout", {
        method: "POST",
        json: { plan, interval: this.interval, workspaceId: this.workspaceId },
      });
      if (r.checkout_url) {
        window.location.href = r.checkout_url;
        return;
      }
      this.fail("No checkout URL returned");
    } catch (e: unknown) {
      const err = e as { body?: { message?: string; error?: string }; message?: string };
      this.fail(err.body?.message || err.body?.error || err.message || "Checkout failed");
    }
  }

  fail(m: string) {
    this.err.set(true);
    this.msg.set(m);
  }
}
