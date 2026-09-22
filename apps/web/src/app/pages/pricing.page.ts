import { Component, signal } from "@angular/core";
import { RouterLink } from "@angular/router";

const CF_DEPLOY =
  "https://deploy.workers.cloudflare.com/?url=https://github.com/sarmaasis/duskly";

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="min-h-dvh w-full overflow-x-hidden bg-[#fbfbfa] font-sans text-[#09090b] antialiased">
      <header class="sticky top-0 z-50 border-b border-[#e4e4e7] bg-[#fbfbfa]/90 backdrop-blur-md">
        <div class="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <a routerLink="/" class="font-display text-[17px] font-extrabold tracking-tight">Dus<span class="text-cta">kly</span></a>
          <div class="flex items-center gap-2">
            <a routerLink="/signin" class="hidden px-2 text-[13px] font-medium text-[#52525b] hover:text-[#09090b] sm:inline">Sign in</a>
            <a routerLink="/signin" class="inline-flex h-8 items-center rounded-full bg-cta px-3.5 text-[12px] font-semibold text-white hover:bg-cta-hover">Start scheduling</a>
          </div>
        </div>
      </header>

      <section class="mx-auto max-w-6xl border-b border-[#e4e4e7] px-4 py-16 text-center sm:px-6">
        <p class="font-mono text-[11px] font-semibold uppercase tracking-widest text-cta">Pricing</p>
        <h1 class="mt-1.5 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Self-host free. Cloud when you want us to run it.</h1>
        <p class="mx-auto mt-2 max-w-xl text-sm text-[#52525b]">USD. Yearly is 10 × monthly (two months free). No card on self-host.</p>
        <div class="mt-5 inline-flex rounded-full border border-[#e4e4e7] bg-white p-1" role="group" aria-label="Billing period">
          <button type="button" (click)="annual.set(false)" [attr.aria-pressed]="!annual()" class="rounded-full px-3 py-1.5 text-xs font-semibold" [class.bg-[#09090b]]="!annual()" [class.text-white]="!annual()" [class.text-[#52525b]]="annual()">Monthly</button>
          <button type="button" (click)="annual.set(true)" [attr.aria-pressed]="annual()" class="rounded-full px-3 py-1.5 text-xs font-semibold" [class.bg-[#09090b]]="annual()" [class.text-white]="annual()" [class.text-[#52525b]]="!annual()">Annual</button>
        </div>
      </section>

      <section class="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <article class="mb-5 flex flex-col gap-6 rounded-xl border border-[#e4e4e7] bg-white p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p class="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#71717a]">Start for $0</p>
            <h2 class="mt-1 font-display text-2xl font-extrabold tracking-tight">Self-host</h2>
            <p class="mt-2 max-w-lg text-sm text-[#52525b]">Deploy open-source Duskly on your own Cloudflare account. Full product under your control.</p>
          </div>
          <div class="shrink-0">
            <p class="font-mono text-4xl font-extrabold leading-none">$0</p>
            <p class="mt-2 font-mono text-[11px] uppercase tracking-wider text-[#71717a]">Forever · open source</p>
            <div class="mt-4 flex flex-wrap gap-2">
              <a href="https://github.com/sarmaasis/duskly" class="inline-flex h-10 items-center rounded-full border border-[#e4e4e7] px-4 text-xs font-bold hover:bg-[#f4f4f1]">Clone the repo</a>
              <a [href]="cfDeploy" class="inline-flex">
                <img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare" width="160" height="40" />
              </a>
            </div>
          </div>
        </article>

        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          @for (plan of plans; track plan.name) {
            <article
              class="relative flex flex-col rounded-xl border p-5 transition duration-200 hover:-translate-y-0.5"
              [class.border-[#09090b]]="plan.popular"
              [class.bg-[#09090b]]="plan.popular"
              [class.text-white]="plan.popular"
              [class.border-[#e4e4e7]]="!plan.popular"
              [class.bg-white]="!plan.popular"
            >
              @if (plan.popular) {
                <span class="absolute right-3 top-3 rounded-full bg-cta px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-white">Popular</span>
              }
              <p class="font-mono text-[11px] uppercase tracking-wider" [class.text-cta]="plan.popular" [class.text-[#71717a]]="!plan.popular">{{ plan.who }}</p>
              <h2 class="mt-2 font-display text-lg font-bold">{{ plan.name }}</h2>
              <p class="mt-4 font-mono text-4xl font-extrabold leading-none tracking-tight">{{ annual() ? '$' + plan.yearly : '$' + plan.monthly }}</p>
              <p class="mt-2 font-mono text-[11px] uppercase tracking-wider" [class.text-cta]="plan.popular" [class.text-[#71717a]]="!plan.popular">
                {{ annual() ? 'Per year, 2 months free' : 'Per month' }}
              </p>
              <p class="mt-3 text-xs leading-relaxed" [class.text-zinc-300]="plan.popular" [class.text-[#52525b]]="!plan.popular">{{ plan.blurb }}</p>
              <ul class="mt-5 flex-1 space-y-2 text-xs">
                @for (f of plan.features; track f) {
                  <li class="flex gap-2"><span class="text-cta">✓</span>{{ f }}</li>
                }
              </ul>
              <a
                routerLink="/signin"
                class="mt-6 inline-flex h-10 items-center justify-center rounded-full text-xs font-bold transition-colors"
                [class.bg-cta]="plan.popular"
                [class.text-white]="plan.popular"
                [class.hover:bg-cta-hover]="plan.popular"
                [class.border]="!plan.popular"
                [class.border-[#e4e4e7]]="!plan.popular"
                [class.hover:bg-[#f4f4f1]]="!plan.popular"
              >Sign in to Cloud</a>
            </article>
          }
        </div>
      </section>

      <section class="mx-auto max-w-6xl border-t border-[#e4e4e7] px-4 py-16 sm:px-6">
        <h2 class="font-display text-2xl font-extrabold tracking-tight">Compare plans</h2>
        <p class="mt-1 text-sm text-[#52525b]">Every Cloud plan includes the full scheduling toolkit. Quotas scale with the plan.</p>
        <div class="mt-5 overflow-x-auto rounded-xl border border-[#e4e4e7] bg-white">
          <table class="min-w-[40rem] w-full text-left text-sm">
            <thead class="bg-[#f7f7f4] font-mono text-[11px] uppercase tracking-wider text-[#71717a]">
              <tr>
                <th class="px-4 py-3 font-semibold">Feature</th>
                <th class="px-4 py-3 text-center font-semibold">Standard</th>
                <th class="px-4 py-3 text-center font-semibold">Team</th>
                <th class="px-4 py-3 text-center font-semibold">Pro</th>
                <th class="px-4 py-3 text-center font-semibold">Ultimate</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#e4e4e7]">
              @for (row of compare; track row[0]) {
                <tr>
                  <th class="px-4 py-3 font-semibold text-[#09090b]">{{ row[0] }}</th>
                  <td class="px-4 py-3 text-center text-[#52525b]">{{ row[1] }}</td>
                  <td class="px-4 py-3 text-center text-[#52525b]">{{ row[2] }}</td>
                  <td class="px-4 py-3 text-center text-[#52525b]">{{ row[3] }}</td>
                  <td class="px-4 py-3 text-center text-[#52525b]">{{ row[4] }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <footer class="border-t border-[#e4e4e7] bg-white px-4 py-8 text-center font-mono text-[12px] text-[#71717a] sm:px-6">
        Standard $29 · Team $39 · Pro $49 · Ultimate $99 — yearly is 10 × monthly.
        <a routerLink="/" class="ml-2 font-semibold text-[#09090b] underline decoration-cta decoration-2 underline-offset-4">Home</a>
      </footer>
    </div>
  `,
})
export class PricingPage {
  readonly cfDeploy = CF_DEPLOY;
  readonly annual = signal(false);

  plans = [
    {
      name: "Standard",
      who: "Content creators",
      monthly: 29,
      yearly: 290,
      blurb: "Best for creators scheduling across a few channels.",
      popular: false,
      features: ["5 channels", "Unlimited posts / month", "AI copilot & picture editor", "3 AI videos · 60 clip minutes / mo", "No team seats"],
    },
    {
      name: "Team",
      who: "Small brands",
      monthly: 39,
      yearly: 390,
      blurb: "Best for small brands that need more channels and teammates.",
      popular: false,
      features: ["10 channels", "Unlimited team members", "Unlimited posts / month", "100 AI images / mo", "10 AI videos · 120 clip minutes / mo"],
    },
    {
      name: "Pro",
      who: "Large businesses",
      monthly: 49,
      yearly: 490,
      blurb: "Best for larger businesses with many channels and heavier AI use.",
      popular: false,
      features: ["30 channels", "Unlimited team members", "Unlimited posts / month", "300 AI images / mo", "30 AI videos · 300 clip minutes / mo"],
    },
    {
      name: "Ultimate",
      who: "Agencies",
      monthly: 99,
      yearly: 990,
      blurb: "Best for agencies managing many clients and channels.",
      popular: true,
      features: ["100 channels", "Unlimited team members", "Unlimited posts / month", "500 AI images / mo", "60 AI videos · 600 clip minutes / mo"],
    },
  ];

  compare = [
    ["Price", "$29/mo · $290/yr", "$39/mo · $390/yr", "$49/mo · $490/yr", "$99/mo · $990/yr"],
    ["Channels", "5", "10", "30", "100"],
    ["Team members", "—", "Unlimited", "Unlimited", "Unlimited"],
    ["Posts per month", "Unlimited", "Unlimited", "Unlimited", "Unlimited"],
    ["AI images / mo", "—", "100", "300", "500"],
    ["AI videos / mo", "3", "10", "30", "60"],
    ["AI clip minutes / mo", "60", "120", "300", "600"],
    ["Picture editor · AI copilot", "✓", "✓", "✓", "✓"],
    ["API · webhooks · integrations", "✓", "✓", "✓", "✓"],
    ["Comments · repeats · delays", "✓", "✓", "✓", "✓"],
    ["Smart agent · cross posting", "✓", "✓", "✓", "✓"],
    ["Internal & global plugs", "✓", "✓", "✓", "✓"],
    ["Analytics · customer groups", "✓", "✓", "✓", "✓"],
    ["Calendar · dark/light · RSS · sets · signatures", "✓", "✓", "✓", "✓"],
  ];
}
