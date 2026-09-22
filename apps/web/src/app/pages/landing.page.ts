import { Component, signal } from "@angular/core";
import { RouterLink } from "@angular/router";

const CF_DEPLOY =
  "https://deploy.workers.cloudflare.com/?url=https://github.com/sarmaasis/duskly";

const PLANS = [
  {
    name: "Self-host",
    price: "$0",
    annual: "",
    note: "Open source",
    features: ["Full product on your Cloudflare", "Limits off", "Your Auth + Email", "Clone & deploy"],
    cta: "Deploy free",
    featured: false,
    href: CF_DEPLOY,
    external: true,
  },
  {
    name: "Standard",
    price: "$29",
    annual: "$290",
    note: "Creators",
    features: ["5 channels", "Unlimited posts / mo", "AI copilot & picture editor", "3 AI videos · 60 clip min"],
    cta: "Start scheduling",
    featured: false,
    href: "/signin",
    external: false,
  },
  {
    name: "Team",
    price: "$39",
    annual: "$390",
    note: "Small brands",
    features: ["10 channels", "Unlimited team members", "100 AI images / mo", "10 AI videos · 120 clip min"],
    cta: "Start scheduling",
    featured: false,
    href: "/signin",
    external: false,
  },
  {
    name: "Pro",
    price: "$49",
    annual: "$490",
    note: "Businesses",
    features: ["30 channels", "Unlimited team members", "300 AI images / mo", "30 AI videos · 300 clip min"],
    cta: "Start scheduling",
    featured: false,
    href: "/signin",
    external: false,
  },
  {
    name: "Ultimate",
    price: "$99",
    annual: "$990",
    note: "Agencies",
    features: ["100 channels", "Unlimited team members", "500 AI images / mo", "60 AI videos · 600 clip min"],
    cta: "Start scheduling",
    featured: true,
    href: "/signin",
    external: false,
  },
];

const FAQS = [
  {
    q: "Is self-host really free?",
    a: "Yes. Open-source Duskly on your Cloudflare account is free from us. You pay only your own Cloudflare usage. Limits are off in self-host mode.",
  },
  {
    q: "What is Duskly Cloud?",
    a: "Managed hosting at duskly.site. Same app as self-host, with plan quotas enforced. Standard starts at $29/mo; Ultimate is $99/mo. Yearly is 10 × monthly (two months free).",
  },
  {
    q: "Which networks can I publish to?",
    a: "Connect channels and schedule cross-posts. Bluesky publishes when an app password is set. Other networks queue honestly until OAuth credentials exist for your deployment.",
  },
  {
    q: "Does AI work on every plan?",
    a: "Copilot and the picture editor are on Cloud plans. AI image quotas start on Team. AI video/clip minutes are included on every Cloud plan at different caps.",
  },
  {
    q: "Can I invite a team on Standard?",
    a: "No. Team seats require Team or higher. Standard is built for solo creators scheduling across a few channels.",
  },
  {
    q: "Who bills Cloud?",
    a: "Dodo Payments is the merchant of record for Duskly Cloud. Self-host never asks for a card.",
  },
];

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="min-h-dvh w-full max-w-full overflow-x-hidden bg-[#fbfbfa] font-sans text-[#09090b] antialiased">
      <header class="sticky top-0 z-50 border-b border-[#e4e4e7] bg-[#fbfbfa]/90 backdrop-blur-md">
        <div class="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div class="flex items-center gap-3">
            <a routerLink="/" class="font-display text-[17px] font-extrabold tracking-tight text-[#09090b]">
              Dus<span class="text-cta">kly</span>
            </a>
            <span class="hidden items-center gap-1.5 rounded border border-[#e4e4e7] bg-white/70 px-2 py-0.5 font-mono text-[11px] text-[#52525b] sm:inline-flex">
              <span class="size-1.5 animate-pulse rounded-full bg-cta"></span>
              Open source
            </span>
          </div>
          <nav class="hidden items-center gap-7 md:flex">
            @for (item of nav; track item.label) {
              <a [href]="item.href" class="text-[13px] font-medium text-[#52525b] hover:text-[#09090b]">{{ item.label }}</a>
            }
          </nav>
          <div class="flex items-center gap-2">
            <a routerLink="/signin" class="hidden px-2 text-[13px] font-medium text-[#52525b] hover:text-[#09090b] sm:inline">Sign in</a>
            <a routerLink="/signin" class="inline-flex h-8 items-center rounded-full bg-cta px-3.5 text-[12px] font-semibold text-white hover:bg-cta-hover">Start scheduling</a>
            <button type="button" class="flex size-9 items-center justify-center text-[#52525b] md:hidden" [attr.aria-expanded]="menuOpen()" (click)="menuOpen.set(!menuOpen())">
              <span class="sr-only">Menu</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                @if (menuOpen()) {
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                } @else {
                  <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                }
              </svg>
            </button>
          </div>
        </div>
        @if (menuOpen()) {
          <div class="border-t border-[#e4e4e7] bg-[#fbfbfa] px-4 py-3 md:hidden">
            <div class="flex flex-col gap-1">
              @for (item of nav; track item.label) {
                <a [href]="item.href" (click)="menuOpen.set(false)" class="py-2 text-[13px] font-medium text-[#52525b]">{{ item.label }}</a>
              }
              <a routerLink="/signin" (click)="menuOpen.set(false)" class="py-2 text-[13px] font-medium text-[#52525b]">Sign in</a>
            </div>
          </div>
        }
      </header>

      <section class="relative overflow-hidden border-b border-[#e4e4e7] pb-16 pt-14">
        <div
          aria-hidden="true"
          class="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,.04)_1px,transparent_1px)] bg-size-[40px_40px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_25%,#000_60%,transparent_100%)] [-webkit-mask-image:radial-gradient(ellipse_70%_60%_at_50%_25%,#000_60%,transparent_100%)]"
        ></div>
        <div class="relative mx-auto max-w-7xl px-6">
          <div class="mx-auto max-w-4xl text-center">
            <p class="mb-8 inline-flex items-center gap-2 rounded-full border border-[#e4e4e7] bg-white/80 px-3 py-1 font-mono text-xs">
              <span class="size-2 animate-pulse rounded-full bg-cta"></span>
              Open-source scheduler
              <span class="text-zinc-300">/</span>
              <span class="text-[11px] text-[#52525b]">Cloud or self-host</span>
            </p>
            <h1 class="mx-auto mb-6 max-w-3xl font-display text-4xl font-extrabold leading-[1.08] tracking-[-0.035em] sm:text-6xl">
              Schedule posts.<br class="hidden sm:block" />
              <span class="underline decoration-cta decoration-4 underline-offset-8">Publish on time.</span>
            </h1>
            <p class="mx-auto mb-8 max-w-2xl text-base leading-relaxed text-[#52525b] sm:text-lg">
              Self-host for free on Cloudflare, or use paid managed hosting at duskly.site. Compose once, queue the slot, publish when due.
            </p>
            <div class="mb-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a routerLink="/signin" class="inline-flex w-full items-center justify-center gap-2 rounded-full bg-cta px-6 py-3 text-sm font-bold text-white hover:bg-cta-hover sm:w-auto">
                Start scheduling <span class="font-mono text-xs text-white/80">→</span>
              </a>
              <a href="#pipeline" class="inline-flex w-full items-center justify-center rounded-full border border-[#e4e4e7] bg-white px-5 py-3 text-sm font-medium text-[#09090b] hover:bg-[#f4f4f1] sm:w-auto">See how it works</a>
            </div>
            <div class="mx-auto max-w-4xl pb-4">
              <p class="mb-4 font-mono text-[10px] font-semibold uppercase tracking-widest text-[#92969b]">Works with</p>
              <div class="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] [-webkit-mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
                <div class="flex w-max animate-marquee items-center">
                  @for (pass of [0, 1]; track pass) {
                    <div class="flex items-center gap-10 px-5" [attr.aria-hidden]="pass === 1 ? true : null">
                      @for (logo of logos; track logo.slug) {
                        <img
                          [src]="'/assets/logos/' + logo.slug + '.svg'"
                          [alt]="logo.name"
                          [attr.aria-label]="logo.name"
                          width="28"
                          height="28"
                          class="size-7 shrink-0 object-contain opacity-90"
                        />
                      }
                    </div>
                  }
                </div>
              </div>
            </div>
          </div>

          <div id="pipeline" class="mx-auto mt-8 max-w-5xl scroll-mt-20">
            <div class="overflow-hidden rounded-xl border border-[#e4e4e7] bg-white shadow-sm">
              <div class="flex h-10 items-center justify-between border-b border-[#e4e4e7] bg-[#f4f4f1]/80 px-4">
                <div class="flex items-center gap-2">
                  <span class="size-2.5 rounded-full bg-zinc-300"></span>
                  <span class="size-2.5 rounded-full bg-zinc-300"></span>
                  <span class="size-2.5 rounded-full bg-zinc-300"></span>
                  <span class="ml-2 font-mono text-[11px] text-[#52525b]">duskly / example schedule</span>
                </div>
                <span class="inline-flex items-center gap-1.5 font-mono text-[11px] text-[#52525b]">
                  <span class="size-1.5 animate-pulse rounded-full bg-cta"></span>
                  Example, not a live account
                </span>
              </div>
              <div class="grid divide-y divide-[#e4e4e7] bg-white lg:grid-cols-12 lg:divide-x lg:divide-y-0">
                <div class="space-y-4 p-5 lg:col-span-5">
                  <div class="flex items-center justify-between">
                    <span class="font-mono text-xs font-semibold">01. Compose</span>
                    <span class="rounded bg-zinc-100 px-2 py-0.5 font-mono text-[11px] text-zinc-600">Draft</span>
                  </div>
                  <div class="overflow-hidden rounded-lg border border-[#e4e4e7] bg-[#fbfbfa]">
                    <div class="relative flex h-44 w-full items-end bg-gradient-to-br from-[#fff5f0] via-[#f4f4f1] to-[#e4e4e7] p-4">
                      <div class="w-full rounded-lg border border-[#e4e4e7] bg-white/90 p-3 shadow-sm">
                        <p class="font-mono text-[10px] text-[#71717a]">post body</p>
                        <p class="mt-1 text-xs leading-relaxed">Launch notes drop Thursday at dusk. Thread + short clip attached.</p>
                      </div>
                    </div>
                    <div class="border-t border-[#e4e4e7] bg-white p-3">
                      <div class="flex items-start gap-2.5">
                        <div class="flex size-6 shrink-0 items-center justify-center rounded-full border border-[#e4e4e7] bg-zinc-100 font-mono text-[10px] font-bold">DK</div>
                        <div>
                          <p class="font-mono text-xs font-semibold">workspace <span class="font-normal text-zinc-400">example</span></p>
                          <p class="mt-0.5 text-xs leading-relaxed">Channels selected · media attached · signature ready</p>
                          <span class="mt-2 inline-block rounded border border-orange-200 bg-orange-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-cta">schedule: Thu 18:00</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="flex flex-col items-center justify-center gap-4 bg-[#f4f4f1]/40 p-5 text-center lg:col-span-2">
                  <p class="font-mono text-[10px] uppercase tracking-wider text-[#71717a]">Calendar</p>
                  <div class="flex size-10 items-center justify-center rounded-full border border-[#e4e4e7] bg-white text-lg">◷</div>
                  <div class="font-mono">
                    <p class="text-xs font-bold">Holds the slot</p>
                    <p class="text-[10px] text-[#71717a]">Queue until due</p>
                  </div>
                  <div class="w-full border-t border-dashed border-zinc-300"></div>
                  <p class="rounded border border-[#e4e4e7] bg-white px-2 py-1 font-mono text-[10px] text-zinc-600">No fake publish</p>
                </div>
                <div class="space-y-4 p-5 lg:col-span-5">
                  <div class="flex items-center justify-between">
                    <span class="font-mono text-xs font-semibold">02. Publish</span>
                    <span class="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-cta">
                      <span class="size-1.5 animate-pulse rounded-full bg-cta"></span>
                      When due
                    </span>
                  </div>
                  <div class="space-y-3 rounded-lg border border-[#e4e4e7] bg-[#fbfbfa] p-3.5">
                    <div class="space-y-2.5 rounded-lg border border-[#e4e4e7] bg-white p-3">
                      <p class="text-xs leading-relaxed">Pipeline pushes to connected channels. Bluesky goes live when credentials are set; others stay queued until OAuth is wired.</p>
                      <div class="flex items-center gap-3 rounded-md border border-[#e4e4e7] bg-[#f4f4f1]/50 p-2">
                        <div class="flex size-12 shrink-0 items-center justify-center rounded border border-[#e4e4e7] bg-white font-mono text-[10px] font-bold text-cta">×3</div>
                        <div class="min-w-0">
                          <p class="truncate text-xs font-semibold">Cross-post set</p>
                          <p class="mt-0.5 font-mono text-[11px]">bluesky · x · linkedin</p>
                        </div>
                      </div>
                    </div>
                    <div class="flex items-center justify-between pt-1 font-mono text-[11px] text-[#52525b]">
                      <span>Status lands on the calendar</span>
                      <span class="font-semibold text-[#09090b]">Honest queue</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how" class="mx-auto max-w-7xl border-b border-[#e4e4e7] px-6 py-20">
        <div class="mb-12 max-w-2xl">
          <p class="font-mono text-[11px] font-semibold uppercase tracking-widest text-cta">How it works</p>
          <h2 class="mt-1.5 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Write once.<br />Queue it. Publish it.</h2>
          <p class="mt-2 text-sm text-[#52525b]">Composer drafts, calendar holds the slot, the publish pipeline pushes when the time hits.</p>
        </div>
        <div class="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-12">
          <article class="flex flex-col justify-between rounded-xl border border-[#e4e4e7] bg-white p-6 transition duration-200 hover:-translate-y-0.5 hover:border-zinc-300 lg:col-span-5">
            <div>
              <div class="mb-4 flex items-center justify-between">
                <span class="rounded border border-[#e4e4e7] bg-[#f4f4f1] px-2 py-0.5 font-mono text-xs font-bold">01</span>
                <span class="font-mono text-[11px] text-[#71717a]">Compose</span>
              </div>
              <h3 class="mb-2 text-base font-bold">Draft, media, schedule</h3>
              <p class="mb-6 text-xs leading-relaxed text-[#52525b]">
                Body, attachments, signatures, and a due time. Copilot can draft;
                <span class="rounded bg-zinc-100 px-1 font-mono text-[11px]">editor</span>
                keeps picture tweaks in your library.
              </p>
            </div>
            <div class="space-y-1.5 rounded-lg border border-[#e4e4e7] bg-[#fbfbfa] p-3.5 font-mono text-[11px] text-[#52525b]">
              <div class="flex justify-between"><span>Channels</span><span class="font-semibold text-[#09090b]">Multi-select</span></div>
              <div class="flex justify-between"><span>AI copilot</span><span class="font-semibold text-cta">Cloud plans</span></div>
            </div>
          </article>
          <article class="flex flex-col justify-between rounded-xl border border-[#e4e4e7] bg-white p-6 transition duration-200 hover:-translate-y-0.5 hover:border-zinc-300 lg:col-span-7">
            <div>
              <div class="mb-4 flex items-center justify-between">
                <span class="rounded border border-[#e4e4e7] bg-[#f4f4f1] px-2 py-0.5 font-mono text-xs font-bold">02</span>
                <span class="font-mono text-[11px] text-[#71717a]">Calendar</span>
              </div>
              <h3 class="mb-2 text-base font-bold">Month and agenda</h3>
              <p class="mb-6 text-xs leading-relaxed text-[#52525b]">See what’s due. Queue now when you need to push early. Repeats, delays, and posting sets stay on the same board.</p>
            </div>
            <div class="grid gap-3 rounded-lg border border-[#e4e4e7] bg-[#fbfbfa] p-3.5 font-mono text-[11px] text-[#52525b] sm:grid-cols-2">
              <div class="flex justify-between sm:border-r sm:border-[#e4e4e7] sm:pr-3"><span>Views</span><span class="font-semibold text-[#09090b]">Month · Agenda</span></div>
              <div class="flex justify-between"><span>Theme</span><span class="font-semibold text-cta">Light · Dark</span></div>
            </div>
          </article>
          <article class="flex flex-col justify-between rounded-xl border border-[#e4e4e7] bg-white p-6 transition duration-200 hover:-translate-y-0.5 hover:border-zinc-300 lg:col-span-4">
            <div>
              <div class="mb-4 flex items-center justify-between">
                <span class="rounded border border-[#e4e4e7] bg-[#f4f4f1] px-2 py-0.5 font-mono text-xs font-bold">03</span>
                <span class="font-mono text-[11px] text-[#71717a]">Publish</span>
              </div>
              <h3 class="mb-2 text-base font-bold">Honest pipeline</h3>
              <p class="mb-6 text-xs leading-relaxed text-[#52525b]">Workers push when due. Bluesky can go live; other networks stay queued until OAuth exists — never fake-published.</p>
            </div>
            <div class="space-y-1.5 rounded-lg border border-[#e4e4e7] bg-[#fbfbfa] p-3.5 font-mono text-[11px] text-[#52525b]">
              <div class="flex justify-between"><span>Path</span><span class="font-semibold text-[#09090b]">Queue → send</span></div>
              <div class="flex justify-between"><span>Status</span><span class="font-semibold text-cta">Real only</span></div>
            </div>
          </article>
          @for (tile of tiles; track tile.title; let i = $index) {
            <article
              class="rounded-xl border border-[#e4e4e7] bg-white p-5 transition duration-200 hover:-translate-y-0.5 hover:border-zinc-300"
              [class.lg:col-span-4]="i < 2"
              [class.lg:col-span-3]="i >= 2"
            >
              <h3 class="mb-1 text-sm font-bold">{{ tile.title }}</h3>
              <p class="text-xs leading-relaxed text-[#52525b]">{{ tile.body }}</p>
            </article>
          }
        </div>
      </section>

      <section id="deploy" class="mx-auto max-w-7xl border-b border-[#e4e4e7] px-6 py-20">
        <div class="mb-12 max-w-2xl">
          <p class="font-mono text-[11px] font-semibold uppercase tracking-widest text-cta">Setup</p>
          <h2 class="mt-1.5 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Self-host free.<br />Or let us run it.</h2>
          <p class="mt-2 text-sm text-[#52525b]">Same app either way. Deploy on your Cloudflare account, or pick a Duskly Cloud plan.</p>
        </div>
        <div class="grid items-stretch gap-8 lg:grid-cols-12">
          <div class="flex flex-col justify-between rounded-xl border border-[#e4e4e7] bg-white p-6 lg:col-span-5">
            <div class="space-y-4">
              <div class="flex items-center justify-between border-b border-[#e4e4e7] pb-3">
                <span class="font-mono text-[11px] font-semibold uppercase tracking-widest text-cta">Self-host</span>
                <span class="font-mono text-[11px] text-[#71717a]">Cloudflare Workers</span>
              </div>
              <h3 class="font-display text-2xl font-extrabold tracking-tight">Open source on your account.</h3>
              <p class="text-sm leading-relaxed text-[#52525b]">Clone the repo and deploy. Limits stay off in self-host mode. You bring Auth and your Cloudflare bill.</p>
              <ul class="space-y-2 font-mono text-xs">
                <li class="flex gap-2"><span class="font-bold text-cta">✓</span>Full scheduling toolkit</li>
                <li class="flex gap-2"><span class="font-bold text-cta">✓</span>Your D1 / KV / R2 / Queues</li>
                <li class="flex gap-2"><span class="font-bold text-cta">✓</span>No Duskly Cloud fees</li>
              </ul>
            </div>
            <div class="mt-6 flex flex-wrap items-center gap-3">
              <a href="https://github.com/sarmaasis/duskly" class="inline-flex h-10 items-center rounded-full border border-[#e4e4e7] bg-white px-4 text-xs font-bold hover:bg-[#f4f4f1]">Clone the repo</a>
              <a [href]="cfDeploy" class="inline-flex">
                <img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare" width="160" height="40" />
              </a>
            </div>
            <div class="mt-6 overflow-hidden rounded-lg border border-[#e4e4e7] bg-[#18181b] font-mono text-xs text-zinc-300">
              <div class="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-3.5 py-2">
                <span class="text-[10px] text-zinc-400">wrangler.toml</span>
                <span class="inline-flex items-center gap-1.5 text-[10px] font-medium text-cta">
                  <span class="size-1.5 animate-pulse rounded-full bg-cta"></span>
                  example
                </span>
              </div>
              <pre class="overflow-x-auto p-3.5 text-[11px] leading-relaxed">{{ exampleConfig }}</pre>
            </div>
          </div>
          <div class="overflow-hidden rounded-xl border border-[#e4e4e7] bg-white lg:col-span-7">
            <div class="grid h-full divide-y divide-[#e4e4e7] md:grid-cols-12 md:divide-x md:divide-y-0">
              <div class="space-y-4 p-6 sm:p-7 md:col-span-7">
                <div class="flex items-center justify-between border-b border-[#e4e4e7] pb-3">
                  <span class="font-mono text-[11px] uppercase tracking-wider text-[#52525b]">What you get</span>
                  <span class="font-mono text-[11px] text-[#71717a]">Cloud included</span>
                </div>
                @for (row of visibleRows; track row.label) {
                  <div class="flex items-start justify-between gap-4 border-b border-[#e4e4e7] pb-3 last:border-0">
                    <div>
                      <p class="text-xs font-semibold">{{ row.label }}</p>
                      <p class="mt-0.5 text-[11px] text-[#52525b]">{{ row.detail }}</p>
                    </div>
                  </div>
                }
              </div>
              <div class="flex flex-col justify-between bg-[#f4f4f1]/60 p-6 sm:p-7 md:col-span-5">
                <div>
                  <div class="flex items-center justify-between border-b border-[#e4e4e7] pb-3">
                    <span class="font-mono text-[11px] uppercase tracking-wider text-[#52525b]">Plans</span>
                    <span class="inline-flex items-center gap-1 rounded border border-orange-200 bg-orange-50 px-1.5 py-0.5 font-mono text-[11px] text-cta">
                      <span class="size-1.5 animate-pulse rounded-full bg-cta"></span>
                      USD
                    </span>
                  </div>
                  <p class="my-6 font-mono text-4xl font-bold tracking-tight">$0</p>
                  <p class="font-mono text-[11px] text-[#52525b]">Self-host free. Cloud: Standard $29 · Team $39 · Pro $49 · Ultimate $99. Yearly = 10 × monthly.</p>
                </div>
                <a routerLink="/signin" class="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#09090b] text-xs font-semibold text-white hover:bg-zinc-800">
                  Start with Cloud <span class="font-mono text-cta">→</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="mx-auto max-w-7xl border-b border-[#e4e4e7] px-6 py-20">
        <div class="rounded-xl border border-[#e4e4e7] bg-white p-8 sm:p-10">
          <div class="grid items-center gap-8 lg:grid-cols-12">
            <div class="lg:col-span-4">
              <div class="relative flex h-56 w-full flex-col justify-between overflow-hidden rounded-lg border border-[#e4e4e7] bg-gradient-to-br from-[#fff5f0] via-[#fbfbfa] to-[#f4f4f1] p-5">
                <p class="font-mono text-[10px] uppercase tracking-wider text-[#71717a]">duskly / today</p>
                <div>
                  <p class="font-display text-2xl font-extrabold tracking-tight">18:00</p>
                  <p class="mt-1 text-xs text-[#52525b]">Launch thread queued · 3 channels</p>
                </div>
                <div class="flex items-center gap-2">
                  <span class="rounded-full bg-cta px-2.5 py-1 font-mono text-[10px] font-bold text-white">Queued</span>
                  <span class="font-mono text-[10px] text-[#71717a]">publishes at dusk</span>
                </div>
              </div>
            </div>
            <div class="space-y-4 lg:col-span-8">
              <p class="font-mono text-[11px] font-semibold uppercase tracking-widest text-cta">The moment</p>
              <h2 class="font-display text-2xl font-semibold leading-snug sm:text-3xl">Built for the hour you meant to post.</h2>
              <p class="max-w-xl text-sm leading-relaxed text-[#52525b]">A draft is the opening. Duskly holds the calendar slot, pushes when due, and keeps status honest across every connected channel.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" class="mx-auto max-w-6xl border-t border-[#e4e4e7] px-4 py-16 sm:px-6">
        <div class="mx-auto mb-10 max-w-xl text-center">
          <p class="font-mono text-[11px] font-semibold uppercase tracking-widest text-cta">Pricing</p>
          <h2 class="mt-1.5 font-display text-3xl font-extrabold tracking-tight">Self-host free. Cloud when you want us to run it.</h2>
          <p class="mt-2 text-sm text-[#52525b]">USD. Yearly is 10 × monthly (two months free). No card on self-host.</p>
          <div class="mt-5 inline-flex rounded-full border border-[#e4e4e7] bg-white p-1" role="group" aria-label="Billing period">
            <button type="button" (click)="annual.set(false)" [attr.aria-pressed]="!annual()" class="rounded-full px-3 py-1.5 text-xs font-semibold transition-colors" [class.bg-[#09090b]]="!annual()" [class.text-white]="!annual()" [class.text-[#52525b]]="annual()">Monthly</button>
            <button type="button" (click)="annual.set(true)" [attr.aria-pressed]="annual()" class="rounded-full px-3 py-1.5 text-xs font-semibold transition-colors" [class.bg-[#09090b]]="annual()" [class.text-white]="annual()" [class.text-[#52525b]]="!annual()">Annual</button>
          </div>
        </div>
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          @for (plan of plans; track plan.name) {
            <article
              class="flex flex-col rounded-xl border p-5 transition duration-200 hover:-translate-y-0.5"
              [class.border-[#09090b]]="plan.featured"
              [class.bg-[#09090b]]="plan.featured"
              [class.text-white]="plan.featured"
              [class.border-[#e4e4e7]]="!plan.featured"
              [class.bg-white]="!plan.featured"
            >
              <p class="font-mono text-[11px] uppercase tracking-wider" [class.text-cta]="plan.featured" [class.text-[#71717a]]="!plan.featured">{{ plan.note }}</p>
              <h3 class="mt-2 font-display text-lg font-bold">{{ plan.name }}</h3>
              <p class="mt-4 font-mono text-4xl font-extrabold leading-none tracking-tight">{{ price(plan) }}</p>
              <p class="mt-2 font-mono text-[11px] uppercase tracking-wider" [class.text-cta]="plan.featured" [class.text-[#71717a]]="!plan.featured">{{ cadence(plan) }}</p>
              <ul class="mt-5 flex-1 space-y-2 text-xs">
                @for (feature of plan.features; track feature) {
                  <li class="flex gap-2"><span class="text-cta">✓</span>{{ feature }}</li>
                }
              </ul>
              @if (plan.external) {
                <a [href]="plan.href" class="mt-6 inline-flex h-10 items-center justify-center rounded-full border border-[#e4e4e7] text-xs font-bold hover:bg-[#f4f4f1]">{{ plan.cta }}</a>
              } @else {
                <a
                  [routerLink]="plan.href"
                  class="mt-6 inline-flex h-10 items-center justify-center rounded-full text-xs font-bold transition-colors duration-200"
                  [class.bg-cta]="plan.featured"
                  [class.text-white]="plan.featured"
                  [class.hover:bg-cta-hover]="plan.featured"
                  [class.border]="!plan.featured"
                  [class.border-[#e4e4e7]]="!plan.featured"
                  [class.hover:bg-[#f4f4f1]]="!plan.featured"
                >{{ plan.cta }}</a>
              }
            </article>
          }
        </div>
        <p class="mt-6 text-center">
          <a routerLink="/pricing" class="font-mono text-xs font-semibold text-[#52525b] underline decoration-cta decoration-2 underline-offset-4 hover:text-[#09090b]">Full plan comparison →</a>
        </p>
      </section>

      <section id="faq" class="mx-auto max-w-3xl border-t border-[#e4e4e7] px-4 py-16 sm:px-6">
        <h2 class="mb-8 text-center font-display text-2xl font-extrabold tracking-tight">Questions</h2>
        <div class="divide-y divide-[#e4e4e7] border-y border-[#e4e4e7]">
          @for (item of faqs; track item.q; let i = $index) {
            <div>
              <button type="button" class="flex w-full items-center justify-between gap-4 py-4 text-left text-sm font-semibold" [attr.aria-expanded]="openFaq() === i" (click)="openFaq.set(openFaq() === i ? -1 : i)">
                {{ item.q }}
                <span class="font-mono text-[#71717a]">{{ openFaq() === i ? '−' : '+' }}</span>
              </button>
              @if (openFaq() === i) {
                <p class="pb-4 text-sm leading-relaxed text-[#52525b]">{{ item.a }}</p>
              }
            </div>
          }
        </div>
      </section>

      <section class="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        <div class="rounded-xl border border-[#e4e4e7] bg-white px-6 py-12 text-center sm:px-14">
          <h2 class="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Turn the next draft into a scheduled post.</h2>
          <p class="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-[#52525b]">Self-host on Cloudflare, or start on Duskly Cloud. Same composer, calendar, and publish pipeline.</p>
          <div class="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a routerLink="/signin" class="inline-flex w-full items-center justify-center gap-2 rounded-full bg-cta px-6 py-3 text-sm font-bold text-white hover:bg-cta-hover sm:w-auto">
              Start scheduling <span class="font-mono text-xs">→</span>
            </a>
            <a [href]="cfDeploy" class="inline-flex">
              <img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare" width="160" height="40" />
            </a>
          </div>
        </div>
      </section>

      <footer class="border-t border-[#e4e4e7] bg-white">
        <div class="mx-auto max-w-6xl px-4 pb-8 pt-12 sm:px-6">
          <div class="mb-12 grid grid-cols-2 gap-8 md:grid-cols-6">
            <div class="col-span-2 space-y-3">
              <a routerLink="/" class="font-display text-[15px] font-extrabold tracking-tight text-[#09090b]">Dus<span class="text-cta">kly</span></a>
              <p class="max-w-xs text-[13px] leading-5 text-[#52525b]">Open-source social scheduler. Self-host free, or use paid Cloud at duskly.site.</p>
              <a href="mailto:hello@duskly.site" class="inline-block font-mono text-[12px] text-[#09090b] underline decoration-cta decoration-2 underline-offset-4">hello&#64;duskly.site</a>
            </div>
            @for (col of footerCols; track col.label) {
              <div class="space-y-2.5 font-mono text-[12px]">
                <p class="text-[11px] font-semibold uppercase tracking-wider text-[#09090b]">{{ col.label }}</p>
                @for (link of col.links; track link.label) {
                  @if (link.external) {
                    <a [href]="link.href" class="block text-[#52525b] hover:text-[#09090b]">{{ link.label }}</a>
                  } @else if (link.href.startsWith('/#')) {
                    <a [href]="link.href" class="block text-[#52525b] hover:text-[#09090b]">{{ link.label }}</a>
                  } @else {
                    <a [routerLink]="link.href" class="block text-[#52525b] hover:text-[#09090b]">{{ link.label }}</a>
                  }
                }
              </div>
            }
          </div>
          <div class="flex flex-col gap-2 border-t border-[#e4e4e7] pt-6 font-mono text-[12px] text-[#71717a] sm:flex-row sm:items-center sm:justify-between">
            <p>&copy; {{ year }} Duskly. Cloud billing by Dodo Payments.</p>
            <p>Self-host free. Cloud from $29/mo.</p>
          </div>
        </div>
      </footer>
    </div>
  `,
})
export class LandingPage {
  readonly cfDeploy = CF_DEPLOY;
  readonly plans = PLANS;
  readonly faqs = FAQS;
  readonly year = new Date().getFullYear();
  readonly annual = signal(false);
  readonly openFaq = signal(0);
  readonly menuOpen = signal(false);

  readonly nav = [
    { label: "How it works", href: "/#how" },
    { label: "Pipeline", href: "/#pipeline" },
    { label: "Pricing", href: "/#pricing" },
    { label: "GitHub", href: "https://github.com/sarmaasis/duskly" },
  ];

  readonly logos = [
    { slug: "linkedin", name: "LinkedIn" },
    { slug: "x", name: "X" },
    { slug: "instagram", name: "Instagram" },
    { slug: "threads", name: "Threads" },
    { slug: "facebook", name: "Facebook" },
    { slug: "youtube", name: "YouTube" },
    { slug: "reddit", name: "Reddit" },
    { slug: "bluesky", name: "Bluesky" },
    { slug: "mastodon", name: "Mastodon" },
    { slug: "hashnode", name: "Hashnode" },
    { slug: "medium", name: "Medium" },
    { slug: "devto", name: "dev.to" },
    { slug: "telegram", name: "Telegram" },
    { slug: "discord", name: "Discord" },
    { slug: "slack", name: "Slack" },
  ];

  readonly tiles = [
    { title: "Smart agent", body: "Draft and schedule from a brief. Agent runs under your plan quotas." },
    { title: "Team seats", body: "Invite teammates on Team and above. Standard stays solo." },
    { title: "RSS auto-post", body: "Point a feed at a channel. Cron turns new items into queued posts." },
    { title: "API tokens", body: "Mint tokens in settings for scripts and outbound integrations." },
    { title: "Webhooks", body: "Outbound events for your own tools when posts move through the queue." },
    { title: "Analytics", body: "Local post counts and status from your workspace — no vanity metrics." },
  ];

  readonly visibleRows = [
    { label: "Composer", detail: "Drafts, media, signatures, AI copilot" },
    { label: "Calendar", detail: "Month and agenda of what’s due" },
    { label: "Accounts", detail: "Connect channels and cross-post sets" },
    { label: "Publish", detail: "Queue → send when the slot hits" },
  ];

  readonly exampleConfig = `name = "duskly"
compatibility_date = "2025-01-01"
# DUSKLY_MODE = "selfhost"`;

  readonly footerCols = [
    {
      label: "Product",
      links: [
        { label: "How it works", href: "/#how", external: false },
        { label: "Pipeline", href: "/#pipeline", external: false },
        { label: "Pricing", href: "/#pricing", external: false },
        { label: "FAQ", href: "/#faq", external: false },
      ],
    },
    {
      label: "Deploy",
      links: [
        { label: "GitHub", href: "https://github.com/sarmaasis/duskly", external: true },
        { label: "Cloudflare Deploy", href: CF_DEPLOY, external: true },
        { label: "Plans", href: "/pricing", external: false },
      ],
    },
    {
      label: "Cloud",
      links: [
        { label: "Sign in", href: "/signin", external: false },
        { label: "Standard $29", href: "/pricing", external: false },
        { label: "Ultimate $99", href: "/pricing", external: false },
      ],
    },
    {
      label: "App",
      links: [
        { label: "Calendar", href: "/app", external: false },
        { label: "Compose", href: "/app/compose", external: false },
        { label: "Settings", href: "/app/settings", external: false },
      ],
    },
  ];

  price(plan: (typeof PLANS)[number]) {
    return this.annual() && plan.annual ? plan.annual : plan.price;
  }

  cadence(plan: (typeof PLANS)[number]) {
    if (plan.price === "$0") return "No card";
    return this.annual() && plan.annual ? "Per year, 2 months free" : "Per month";
  }
}
