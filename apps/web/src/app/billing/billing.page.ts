import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { api, type PlanSnapshot, type Workspace } from "../lib/api";
import { SessionService } from "../lib/session";
import { DkSeg } from "../ui/forms";

type CloudPlanId = "standard" | "team" | "pro" | "ultimate";

const PLAN_NAMES: Record<CloudPlanId, string> = {
  standard: "Standard",
  team: "Team",
  pro: "Pro",
  ultimate: "Ultimate",
};

const PLANS: {
  id: CloudPlanId;
  name: string;
  who: string;
  monthly: number;
  yearly: number;
  blurb: string;
  features: string[];
}[] = [
  {
    id: "standard",
    name: "Standard",
    who: "Content creators",
    monthly: 29,
    yearly: 290,
    blurb: "Best for creators scheduling across a few channels.",
    features: ["5 channels", "Unlimited posts / month", "AI copilot & picture editor", "3 short AI videos / mo", "No team seats"],
  },
  {
    id: "team",
    name: "Team",
    who: "Small brands",
    monthly: 39,
    yearly: 390,
    blurb: "Best for small brands that need more channels and teammates.",
    features: ["10 channels", "Unlimited team members", "Unlimited posts / month", "100 AI images / mo", "10 short AI videos / mo"],
  },
  {
    id: "pro",
    name: "Pro",
    who: "Large businesses",
    monthly: 49,
    yearly: 490,
    blurb: "Best for larger businesses with many channels and heavier AI use.",
    features: ["30 channels", "Unlimited team members", "Unlimited posts / month", "300 AI images / mo", "30 short AI videos / mo"],
  },
  {
    id: "ultimate",
    name: "Ultimate",
    who: "Agencies",
    monthly: 99,
    yearly: 990,
    blurb: "Best for agencies managing many clients and channels.",
    features: ["100 channels", "Unlimited team members", "Unlimited posts / month", "500 AI images / mo", "60 short AI videos / mo"],
  },
];

function displayPlanName(plan: string | null | undefined, cloud: boolean): string {
  if (!cloud || plan === "selfhost") return "Self-host";
  if (plan && plan in PLAN_NAMES) return PLAN_NAMES[plan as CloudPlanId];
  return "Standard";
}

@Component({
  standalone: true,
  imports: [RouterLink, DkSeg],
  template: `
    <div class="mx-auto w-full max-w-7xl space-y-8">
      <div class="border-b border-[#e8e8e3] pb-8 dark:border-zinc-800">
        <div class="mb-1.5 flex items-center gap-2">
          <span class="text-xs font-semibold uppercase tracking-wider text-cta">Account</span>
          <span class="text-zinc-300 dark:text-zinc-600">/</span>
          <span class="font-mono text-xs font-medium text-zinc-500">Plan &amp; checkout</span>
        </div>
        <h1 class="font-display text-3xl font-bold tracking-tight text-[#121417] md:text-4xl dark:text-zinc-50">Billing</h1>
        <p class="mt-1.5 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
          Cloud plans are billed through Dodo Payments. Self-host stays at $0 with billing off.
        </p>
      </div>

      @if (msg()) {
        <p
          class="rounded-2xl border border-[#e8e8e3] bg-white px-4 py-3 text-[13px] shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
          [class.text-red-600]="err()"
          [class.text-[#365314]]="!err()"
        >{{ msg() }}</p>
      }

      @if (!sessionReady()) {
        <section class="rounded-2xl border border-[#e8e8e3] bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <p class="text-sm text-zinc-500 dark:text-zinc-400">Loading billing…</p>
        </section>
      } @else if (!signedIn()) {
        <section class="rounded-2xl border border-[#e8e8e3] bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div class="flex items-center gap-2.5">
            <div class="flex size-8 items-center justify-center rounded-lg bg-orange-50 text-cta dark:bg-orange-950/40">
              <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" stroke-linecap="round" />
              </svg>
            </div>
            <div>
              <h2 class="font-display text-base font-bold text-[#121417] dark:text-zinc-50">Sign in to see billing</h2>
              <p class="text-xs text-zinc-500 dark:text-zinc-400">Your current plan and Cloud prices show after you sign in.</p>
            </div>
          </div>
          <a routerLink="/signin" class="mt-6 inline-flex h-10 items-center rounded-full bg-cta px-4 text-xs font-semibold text-white hover:bg-cta-hover">Sign in</a>
        </section>
      } @else {
        <section class="rounded-2xl border border-[#e8e8e3] bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div class="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div class="min-w-0">
              <p class="text-[11px] font-semibold uppercase text-zinc-400">Current plan</p>
              <h2 class="mt-1 font-display text-2xl font-bold text-[#121417] dark:text-zinc-50">{{ currentName() }}</h2>
              @if (selfHost()) {
                <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Billing is off. Self-host is $0 — no checkout, no card.</p>
              } @else {
                <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Duskly Cloud. Switch plans below; yearly is 10 × monthly (two months free).</p>
              }
            </div>
            <div class="shrink-0 rounded-xl border border-[#e8e8e3] bg-[#f7f7f4] px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800">
              <p class="text-[11px] font-semibold uppercase text-zinc-400">{{ selfHost() ? 'Self-host' : 'Cloud' }}</p>
              <p class="mt-0.5 font-mono text-2xl font-extrabold text-[#121417] dark:text-zinc-50">{{ selfHost() ? '$0' : currentPrice() }}</p>
              <p class="mt-1 font-mono text-[11px] uppercase tracking-wider text-zinc-400">{{ selfHost() ? 'Billing off' : (interval === 'year' ? 'Per year' : 'Per month') }}</p>
            </div>
          </div>
        </section>

        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="font-display text-xl font-bold text-[#121417] dark:text-zinc-50">Cloud plans</h2>
            <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Standard $29/$290 · Team $39/$390 · Pro $49/$490 · Ultimate $99/$990.</p>
          </div>
          <dk-seg [options]="intervalOpts" [value]="interval" (pick)="interval=$any($event)" />
        </div>

        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          @for (p of plans; track p.id) {
            <article
              class="flex min-w-0 flex-col rounded-2xl border bg-white p-6 shadow-sm dark:bg-zinc-900"
              [class.border-[#121417]]="isCurrent(p.id)"
              [class.dark:border-zinc-100]="isCurrent(p.id)"
              [class.border-[#e8e8e3]]="!isCurrent(p.id)"
              [class.dark:border-zinc-700]="!isCurrent(p.id)"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="font-mono text-[11px] uppercase tracking-wider text-zinc-400">{{ p.who }}</p>
                  <h3 class="mt-1 font-display text-lg font-bold text-[#121417] dark:text-zinc-50">{{ p.name }}</h3>
                </div>
                @if (isCurrent(p.id)) {
                  <span class="shrink-0 rounded-full bg-cta px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-white">Current</span>
                }
              </div>
              <p class="mt-4 font-mono text-3xl font-extrabold leading-none tracking-tight text-[#121417] dark:text-zinc-50">
                {{ '$' + (interval === 'year' ? p.yearly : p.monthly) }}
              </p>
              <p class="mt-1.5 font-mono text-[11px] uppercase tracking-wider text-zinc-400">
                {{ interval === 'year' ? '$' + p.yearly + '/yr · two months free' : '$' + p.monthly + '/mo' }}
              </p>
              <p class="mt-3 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{{ p.blurb }}</p>
              <ul class="mt-4 flex-1 space-y-2 text-xs text-[#121417] dark:text-zinc-200">
                @for (f of p.features; track f) {
                  <li class="flex gap-2"><span class="text-cta">✓</span><span>{{ f }}</span></li>
                }
              </ul>
              @if (selfHost()) {
                <p class="mt-6 text-xs text-zinc-500 dark:text-zinc-400">Available on Cloud only. Billing is off here.</p>
              } @else {
                <button
                  type="button"
                  (click)="checkout(p.id)"
                  [disabled]="busy() === p.id"
                  class="mt-6 inline-flex h-10 w-full items-center justify-center rounded-full bg-cta text-xs font-semibold text-white transition-colors hover:bg-cta-hover disabled:opacity-50"
                >{{ busy() === p.id ? 'Starting checkout…' : 'Checkout' }}</button>
              }
            </article>
          }
        </div>

        <p class="text-[12px] text-zinc-500 dark:text-zinc-400">
          Need the full comparison?
          <a routerLink="/pricing" class="font-semibold text-[#121417] underline decoration-cta underline-offset-2 dark:text-zinc-100">View public pricing</a>
        </p>
      }
    </div>
  `,
})
export class BillingPage implements OnInit {
  workspaceId = "";
  interval: "month" | "year" = "month";
  intervalOpts = [
    { value: "month", label: "Monthly" },
    { value: "year", label: "Yearly" },
  ];
  readonly plans = PLANS;
  readonly session = inject(SessionService);
  msg = signal("");
  err = signal(false);
  sessionReady = signal(false);
  signedIn = signal(false);
  cloud = signal(false);
  usage = signal<PlanSnapshot | null>(null);
  busy = signal<CloudPlanId | "">("");

  readonly selfHost = computed(() => !this.cloud() || this.usage()?.plan === "selfhost");
  readonly currentName = computed(() => displayPlanName(this.usage()?.plan, this.cloud()));

  async ngOnInit() {
    await this.session.ensure();
    if (!this.session.loggedIn()) {
      this.signedIn.set(false);
      this.sessionReady.set(true);
      return;
    }
    try {
      const me = await api<{ workspace: Workspace; usage: PlanSnapshot; cloud: boolean }>("/v1/workspaces/me");
      this.workspaceId = me.workspace.id;
      this.usage.set(me.usage);
      this.cloud.set(!!me.cloud);
      this.signedIn.set(true);
    } catch (e: unknown) {
      this.signedIn.set(true);
      const err = e as { body?: { message?: string; error?: string }; message?: string };
      this.fail(err.body?.message || err.body?.error || err.message || "Could not load the current plan.");
    } finally {
      this.sessionReady.set(true);
    }
  }

  isCurrent(id: CloudPlanId) {
    if (this.selfHost()) return false;
    const plan = this.usage()?.plan;
    return plan === id || (!plan && id === "standard");
  }

  currentPrice() {
    const id = (this.usage()?.plan && this.usage()!.plan in PLAN_NAMES ? this.usage()!.plan : "standard") as CloudPlanId;
    const p = PLANS.find((x) => x.id === id);
    if (!p) return "$29/mo";
    return this.interval === "year" ? `$${p.yearly}/yr` : `$${p.monthly}/mo`;
  }

  async checkout(plan: CloudPlanId) {
    if (this.selfHost() || this.busy()) return;
    this.busy.set(plan);
    this.err.set(false);
    this.msg.set("");
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
    } finally {
      this.busy.set("");
    }
  }

  fail(m: string) {
    this.err.set(true);
    this.msg.set(m);
  }
}
