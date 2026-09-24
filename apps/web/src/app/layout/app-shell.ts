import { Component, DestroyRef, OnInit, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router, RouterOutlet } from "@angular/router";
import { filter } from "rxjs/operators";
import { api, isOnboarded, spaceName, type PlanSnapshot, type Workspace } from "../lib/api";
import { lsSet, setDarkClass } from "../lib/browser";
import { Notices } from "../lib/notices";
import { SessionService } from "../lib/session";

type PostIssue = { network: string; handle: string; status: string; error: string | null };
type AlertPost = { id: string; body: string; status: string; issues?: PostIssue[] };

const NAV = [
  { name: "Calendar", href: "/app", group: "Schedule", exact: true },
  { name: "Compose", href: "/app/compose", group: "Schedule", exact: false },
  { name: "Smart agent", href: "/app/agent", group: "Schedule", exact: false },
  { name: "Accounts", href: "/app/accounts", group: "Account", exact: false },
  { name: "Team", href: "/app/team", group: "Account", exact: false },
  { name: "Analytics", href: "/app/analytics", group: "Account", exact: false },
  { name: "Settings", href: "/app/settings", group: "Account", exact: false },
  { name: "Billing", href: "/app/billing", group: "Account", exact: false },
] as const;

@Component({
  selector: "dk-shell",
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div class="h-dvh overflow-hidden bg-[#fcfcf9] font-sans text-[#121417] dark:bg-zinc-950 dark:text-zinc-100">
      <aside class="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col justify-between border-r border-[#e8e8e3] bg-white dark:border-zinc-800 dark:bg-zinc-900 md:flex" aria-label="Sidebar">
        <div class="flex min-h-0 flex-1 flex-col">
          <div class="flex h-14 shrink-0 items-center border-b border-[#e8e8e3] px-4 dark:border-zinc-800">
            <a href="/" (click)="go($event, '/')" class="font-display text-sm font-bold tracking-tight text-[#09090b] dark:text-zinc-50">
              Dus<span class="text-cta">kly</span>
            </a>
          </div>

          <div class="mx-3 mb-1 mt-3 rounded-lg border border-[#e8e8e3] bg-[#f7f7f4] px-2.5 py-2 dark:border-zinc-700 dark:bg-zinc-800">
            <p class="truncate text-[13px] font-semibold dark:text-zinc-100">{{ label() }}</p>
          </div>

          <nav class="flex-1 overflow-y-auto px-3" aria-label="Main navigation">
            @for (group of groups; track group) {
              <div class="mb-3">
                <p class="px-3 pb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa] dark:text-zinc-500">{{ group }}</p>
                @for (item of nav; track item.href) {
                  @if (item.group === group) {
                    <a
                      [href]="item.href"
                      (click)="go($event, item.href)"
                      class="mb-0.5 flex min-h-[38px] items-center gap-2.5 rounded-lg px-3 text-[13px] transition-colors duration-150"
                      [class.bg-[#09090b]]="active(item)"
                      [class.font-semibold]="active(item)"
                      [class.text-white]="active(item)"
                      [class.hover:bg-[#09090b]]="active(item)"
                      [class.hover:text-white]="active(item)"
                      [class.dark:bg-zinc-100]="active(item)"
                      [class.dark:text-zinc-900]="active(item)"
                      [class.font-medium]="!active(item)"
                      [class.text-[#52525b]]="!active(item)"
                      [class.hover:bg-[#f4f4f1]]="!active(item)"
                      [class.hover:text-[#09090b]]="!active(item)"
                      [class.dark:text-zinc-400]="!active(item)"
                      [class.dark:hover:bg-zinc-800]="!active(item)"
                      [class.dark:hover:text-zinc-100]="!active(item)"
                    >
                      <svg class="size-[17px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" aria-hidden="true">
                        @switch (item.href) {
                          @case ('/app') {
                            <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                          }
                          @case ('/app/compose') {
                            <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          }
                          @case ('/app/agent') {
                            <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
                          }
                          @case ('/app/accounts') {
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                          }
                          @case ('/app/team') {
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                          }
                          @case ('/app/analytics') {
                            <path d="M12 20V10M18 20V4M6 20v-4" />
                          }
                          @case ('/app/settings') {
                            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" />
                          }
                          @case ('/app/billing') {
                            <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" />
                          }
                        }
                      </svg>
                      <span>{{ item.name }}</span>
                    </a>
                  }
                }
              </div>
            }
          </nav>
        </div>

        <div class="shrink-0 border-t border-[#e4e4e7] p-3 dark:border-zinc-800">
          <div class="rounded-xl border border-[#e4e4e7] bg-white p-1 dark:border-zinc-700 dark:bg-zinc-900">
            <button type="button" (click)="toggleTheme()" class="flex w-full items-center gap-2 rounded-lg p-2 text-left transition-colors duration-150 hover:bg-[#f7f7f4] dark:hover:bg-zinc-800">
              <span class="flex size-7 items-center justify-center rounded-full bg-[#121417] font-mono text-[10px] font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">{{ theme() === 'dark' ? 'D' : 'L' }}</span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[12px] font-semibold dark:text-zinc-100">Theme: {{ theme() }}</span>
                <span class="block truncate text-[11px] text-[#63676c] dark:text-zinc-400">{{ cloud() ? 'Duskly Cloud' : 'Self-host' }}</span>
              </span>
            </button>
            <button type="button" (click)="signOut()" class="mt-1 flex w-full items-center rounded-lg px-2 py-2 text-left text-[12px] font-medium text-[#52525b] transition-colors duration-150 hover:bg-[#f7f7f4] hover:text-[#09090b] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <div class="flex h-dvh min-h-0 min-w-0 flex-col md:ml-64">
        <header class="sticky top-0 z-20 hidden h-14 shrink-0 items-center justify-between gap-4 border-b border-[#e8e8e3] bg-white/95 px-5 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/95 md:flex">
          <div class="min-w-0">
            <p class="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa] dark:text-zinc-500">{{ sectionLabel() }}</p>
            <h1 class="truncate font-display text-sm font-bold tracking-tight dark:text-zinc-100">{{ title() }}</h1>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" (click)="toggleInbox()" class="relative inline-flex size-9 items-center justify-center rounded-full border border-[#e8e8e3] bg-[#f7f7f4] text-[#52525b] hover:text-[#09090b] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:text-zinc-50" [attr.aria-expanded]="inboxOpen()" aria-label="Notifications">
              <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
              @if (alerts().length) {
                <span class="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-cta px-1 font-mono text-[9px] font-bold text-white">{{ alerts().length > 9 ? '9+' : alerts().length }}</span>
              }
            </button>
            <span class="inline-flex items-center gap-1.5 rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-2.5 py-1 font-mono text-[11px] font-medium text-[#63676c] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
              {{ usage()?.plan || (cloud() ? 'cloud' : 'self-host') }}
            </span>
            <a href="/app/compose" (click)="go($event, '/app/compose')" class="inline-flex h-9 items-center rounded-full bg-cta px-4 font-mono text-xs font-semibold text-white transition-colors duration-150 hover:bg-cta-hover">
              New post
            </a>
          </div>
        </header>

        <header class="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-2 border-b border-[#e8e8e3] bg-white px-4 dark:border-zinc-800 dark:bg-zinc-900 md:hidden">
          <a href="/" (click)="go($event, '/')" class="font-display text-[15px] font-bold tracking-tight dark:text-zinc-100">Dus<span class="text-cta">kly</span></a>
          <div class="flex items-center gap-2">
            <button type="button" (click)="toggleInbox()" class="relative inline-flex size-9 items-center justify-center rounded-full border border-[#e8e8e3] text-[#52525b] dark:border-zinc-700 dark:text-zinc-300" [attr.aria-expanded]="inboxOpen()" aria-label="Notifications">
              <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
              @if (alerts().length) {
                <span class="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-cta px-1 font-mono text-[9px] font-bold text-white">{{ alerts().length > 9 ? '9+' : alerts().length }}</span>
              }
            </button>
            <a href="/app/compose" (click)="go($event, '/app/compose')" class="inline-flex h-9 items-center rounded-full bg-cta px-3.5 text-xs font-semibold text-white hover:bg-cta-hover">New</a>
          </div>
        </header>

        <main class="min-h-0 flex-1 overflow-y-auto bg-[#fcfcf9] px-5 py-6 pb-24 dark:bg-zinc-950 md:pb-8">
          @if (loadError()) {
            <div class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100" role="alert">
              <p>{{ loadError() }}</p>
              <button type="button" (click)="reload()" class="inline-flex h-8 items-center rounded-full bg-[#09090b] px-3 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">Retry</button>
            </div>
          }
          <router-outlet />
        </main>
      </div>

      <nav class="fixed inset-x-0 bottom-0 z-40 border-t border-[#e8e8e3] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95 md:hidden" aria-label="Mobile navigation">
        <div class="flex h-16 items-center justify-around px-1">
          @for (item of mobileNav; track item.href) {
            <a
              [href]="item.href"
              (click)="mobileGo($event, item)"
              class="relative flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg text-[11px] leading-tight transition-colors duration-150"
              [class.bg-white]="active(item)"
              [class.font-semibold]="active(item)"
              [class.text-[#121417]]="active(item)"
              [class.dark:bg-zinc-800]="active(item)"
              [class.dark:text-zinc-50]="active(item)"
              [class.font-medium]="!active(item)"
              [class.text-[#63676c]]="!active(item)"
              [class.dark:text-zinc-400]="!active(item)"
            >
              <span
                class="absolute top-1 h-[2px] w-5 rounded-full bg-cta"
                [class.opacity-100]="active(item)"
                [class.opacity-0]="!active(item)"
              ></span>
              <svg class="size-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" aria-hidden="true">
                @switch (item.href) {
                  @case ('/app') {
                    <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                  }
                  @case ('/app/compose') {
                    <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  }
                  @case ('/app/accounts') {
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                  }
                  @case ('/app/settings') {
                    <path d="M4 6h16M4 12h16M4 18h16" />
                  }
                }
              </svg>
              <span>{{ item.name }}</span>
            </a>
          }
        </div>
      </nav>

      @if (inboxOpen()) {
        <button type="button" class="fixed inset-0 z-30 bg-transparent" aria-label="Close notifications" (click)="inboxOpen.set(false)"></button>
        <section class="fixed right-3 top-16 z-40 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-[#e8e8e3] bg-white shadow-[0_12px_40px_rgba(15,18,24,0.12)] dark:border-zinc-700 dark:bg-zinc-900 md:right-5 md:top-[4.25rem]" aria-label="Notifications">
          <div class="flex items-center justify-between border-b border-[#e8e8e3] px-3 py-2.5 dark:border-zinc-800">
            <p class="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa]">Needs attention</p>
            <button type="button" (click)="inboxOpen.set(false)" class="text-[12px] font-medium text-[#63676c] hover:text-[#09090b] dark:text-zinc-400 dark:hover:text-zinc-100">Close</button>
          </div>
          <div class="max-h-80 overflow-y-auto">
            @for (post of alerts(); track post.id) {
              <a href="/app" (click)="go($event, '/app')" class="block border-b border-[#e8e8e3] px-3 py-2.5 last:border-0 hover:bg-[#f7f7f4] dark:border-zinc-800 dark:hover:bg-zinc-800">
                <p class="font-mono text-[10px] uppercase tracking-wider text-cta">{{ post.status }}</p>
                <p class="mt-1 line-clamp-2 text-[13px] font-medium dark:text-zinc-100">{{ post.body }}</p>
                @for (issue of post.issues || []; track issue.network + issue.handle) {
                  <p class="mt-1 text-[12px] leading-snug text-[#63676c] dark:text-zinc-400">{{ issue.network }} · {{ issue.handle }} — {{ issue.error || issue.status }}</p>
                }
              </a>
            } @empty {
              <p class="px-3 py-6 text-[13px] text-[#63676c] dark:text-zinc-400">Queued and failed posts show up here with the reason.</p>
            }
          </div>
        </section>
      }

      @if (moreOpen()) {
        <button type="button" class="fixed inset-0 z-30 bg-[#09090b]/30 md:hidden" aria-label="Close menu" (click)="moreOpen.set(false)"></button>
        <section class="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 rounded-xl border border-[#e8e8e3] bg-white p-2 shadow-[0_12px_40px_rgba(15,18,24,0.16)] dark:border-zinc-700 dark:bg-zinc-900 md:hidden" aria-label="More">
          @for (item of moreNav; track item.href) {
            <a [href]="item.href" (click)="go($event, item.href)" class="flex min-h-10 items-center rounded-lg px-3 text-[13px] font-medium text-[#121417] hover:bg-[#f7f7f4] dark:text-zinc-100 dark:hover:bg-zinc-800">{{ item.name }}</a>
          }
          <button type="button" (click)="toggleTheme()" class="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-[13px] font-medium text-[#121417] hover:bg-[#f7f7f4] dark:text-zinc-100 dark:hover:bg-zinc-800">Theme: {{ theme() }}</button>
          <button type="button" (click)="signOut()" class="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-[13px] font-medium text-[#52525b] hover:bg-[#f7f7f4] dark:text-zinc-400 dark:hover:bg-zinc-800">Sign out</button>
        </section>
      }

      <div class="pointer-events-none fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex flex-col gap-2 md:inset-x-auto md:bottom-6 md:right-6 md:w-80" aria-live="polite">
        @for (note of notices.items(); track note.id) {
          <div class="pointer-events-auto flex items-start gap-3 rounded-xl border px-3 py-2.5 text-[13px] shadow-[0_8px_24px_rgba(15,18,24,0.12)]" [class.border-red-200]="note.tone === 'error'" [class.bg-red-50]="note.tone === 'error'" [class.text-red-900]="note.tone === 'error'" [class.dark:border-red-900]="note.tone === 'error'" [class.dark:bg-red-950]="note.tone === 'error'" [class.dark:text-red-100]="note.tone === 'error'" [class.border-[#e8e8e3]]="note.tone !== 'error'" [class.bg-white]="note.tone !== 'error'" [class.dark:border-zinc-700]="note.tone !== 'error'" [class.dark:bg-zinc-900]="note.tone !== 'error'" role="status">
            <p class="min-w-0 flex-1">{{ note.text }}</p>
            <button type="button" (click)="notices.dismiss(note.id)" class="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[#63676c]" aria-label="Dismiss">Close</button>
          </div>
        }
      </div>
    </div>
  `,
})
export class AppShell implements OnInit {
  readonly nav = NAV;
  readonly groups = ["Schedule", "Account"] as const;
  readonly mobileNav = [
    { name: "Calendar", href: "/app", exact: true, more: false },
    { name: "Compose", href: "/app/compose", exact: false, more: false },
    { name: "Accounts", href: "/app/accounts", exact: false, more: false },
    { name: "More", href: "/app/settings", exact: false, more: true },
  ] as const;
  readonly moreNav = [
    { name: "Smart agent", href: "/app/agent" },
    { name: "Analytics", href: "/app/analytics" },
    { name: "Team", href: "/app/team" },
    { name: "Billing", href: "/app/billing" },
    { name: "Settings", href: "/app/settings" },
  ] as const;

  workspace = signal<Workspace | null>(null);
  usage = signal<PlanSnapshot | null>(null);
  cloud = signal(false);
  theme = signal<"light" | "dark">("light");
  path = signal("/app");
  loadError = signal("");
  alerts = signal<AlertPost[]>([]);
  inboxOpen = signal(false);
  moreOpen = signal(false);
  readonly notices = inject(Notices);

  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly session = inject(SessionService);

  constructor() {
    const sync = () => this.path.set(this.router.url.split("?")[0] || "/app");
    sync();
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        sync();
        this.inboxOpen.set(false);
        this.moreOpen.set(false);
      });
  }

  mobileGo(event: Event, item: { href: string; more: boolean }) {
    event.preventDefault();
    if (item.more) {
      this.inboxOpen.set(false);
      this.moreOpen.update((open) => !open);
      return;
    }
    this.moreOpen.set(false);
    void this.router.navigateByUrl(item.href);
  }

  toggleInbox() {
    this.moreOpen.set(false);
    this.inboxOpen.update((open) => !open);
  }

  active(item: { href: string; exact: boolean; more?: boolean }) {
    if (item.more) {
      return this.moreOpen() || this.moreNav.some((entry) => this.path() === entry.href || this.path().startsWith(entry.href + "/"));
    }
    const path = this.path();
    if (item.exact) return path === item.href;
    return path === item.href || path.startsWith(item.href + "/");
  }

  go(event: Event, href: string) {
    event.preventDefault();
    void this.router.navigateByUrl(href);
  }

  title() {
    const titles: Record<string, string> = {
      "/app": "Calendar",
      "/app/compose": "Compose",
      "/app/agent": "Smart agent",
      "/app/accounts": "Accounts",
      "/app/team": "Team",
      "/app/analytics": "Analytics",
      "/app/settings": "Settings",
      "/app/billing": "Billing",
      "/app/billing/success": "Billing",
    };
    return titles[this.path()] || "Duskly";
  }

  sectionLabel() {
    const path = this.path();
    if (path.startsWith("/app/settings") || path.startsWith("/app/billing") || path.startsWith("/app/team") || path.startsWith("/app/accounts") || path.startsWith("/app/analytics")) {
      return "Account";
    }
    return "Schedule";
  }

  async ngOnInit() {
    await this.reload();
  }

  async reload() {
    this.loadError.set("");
    try {
      const data = await api<{ workspace: Workspace; usage: PlanSnapshot; cloud: boolean }>("/v1/workspaces/me");
      if (!isOnboarded(data.workspace)) {
        await this.router.navigateByUrl("/onboarding");
        return;
      }
      this.workspace.set(data.workspace);
      this.usage.set(data.usage);
      this.cloud.set(data.cloud);
      const t = (data.workspace.theme === "dark" ? "dark" : "light") as "light" | "dark";
      this.theme.set(t);
      setDarkClass(t === "dark");
      lsSet("dk-ws", data.workspace.id);
      await this.loadAlerts(data.workspace.id);
    } catch {
      this.loadError.set("Could not load this workspace. Check that you are signed in and the API is reachable.");
    }
  }

  async loadAlerts(workspaceId: string) {
    try {
      const data = await api<{ posts: AlertPost[] }>(`/v1/posts?workspaceId=${workspaceId}`);
      this.alerts.set(
        (data.posts || []).filter(
          (post) => post.status === "queued" || post.status === "failed" || (post.issues?.length ?? 0) > 0,
        ),
      );
    } catch {
      this.alerts.set([]);
    }
  }

  label() {
    return spaceName(this.workspace());
  }

  async signOut() {
    await this.session.signOut();
    await this.router.navigateByUrl("/");
  }

  async toggleTheme() {
    const next = this.theme() === "light" ? "dark" : "light";
    this.theme.set(next);
    setDarkClass(next === "dark");
    const ws = this.workspace();
    if (ws) {
      try {
        await api(`/v1/workspaces/${ws.id}`, { method: "PATCH", json: { theme: next } });
      } catch {
        this.notices.push("error", "Theme saved on this device. The workspace did not update.");
      }
    }
  }
}
