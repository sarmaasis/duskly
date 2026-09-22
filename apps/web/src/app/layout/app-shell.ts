import { Component, DestroyRef, OnInit, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from "@angular/router";
import { filter } from "rxjs/operators";
import { api, type PlanSnapshot, type Workspace } from "../lib/api";
import { lsSet, setDarkClass } from "../lib/browser";

const NAV = [
  { name: "Calendar", href: "/app", group: "Schedule", exact: true },
  { name: "Compose", href: "/app/compose", group: "Schedule", exact: false },
  { name: "Smart agent", href: "/app/agent", group: "Schedule", exact: false },
  { name: "Accounts", href: "/app/accounts", group: "Workspace", exact: false },
  { name: "Team", href: "/app/team", group: "Workspace", exact: false },
  { name: "Analytics", href: "/app/analytics", group: "Workspace", exact: false },
  { name: "Settings", href: "/app/settings", group: "Workspace", exact: false },
] as const;

@Component({
  selector: "dk-shell",
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <div class="h-dvh bg-[#fcfcf9] font-sans text-[#121417]">
      <aside class="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col justify-between border-r border-[#e8e8e3] bg-white md:flex" aria-label="Sidebar">
        <div class="flex min-h-0 flex-1 flex-col">
          <div class="flex h-14 shrink-0 items-center justify-between border-b border-[#e8e8e3] px-4">
            <a routerLink="/" class="font-display text-sm font-bold tracking-tight text-[#09090b]">
              Dus<span class="text-cta">kly</span>
            </a>
            <span class="inline-flex items-center gap-1.5 rounded-full border border-[#e8e8e3] bg-[#f7f7f4] px-2 py-0.5 font-mono text-[10px] font-semibold text-[#63676c]">
              <span class="size-1.5 animate-pulse rounded-full bg-cta"></span>
              {{ cloud() ? (usage()?.plan || 'cloud') : 'self-host' }}
            </span>
          </div>

          <div class="mx-3 mb-1 mt-3 rounded-lg border border-[#e8e8e3] bg-[#f7f7f4] px-2.5 py-2">
            <p class="truncate text-[13px] font-semibold">{{ workspace()?.name || 'Workspace' }}</p>
            <p class="mt-0.5 flex items-center gap-1.5 truncate font-mono text-[11px] text-[#71717a]">
              <span class="size-1.5 rounded-full bg-cta"></span>
              {{ usage()?.plan || 'standard' }}
            </p>
          </div>

          <nav class="flex-1 overflow-y-auto px-3" aria-label="Main navigation">
            @for (group of groups; track group) {
              <div class="mb-3">
                <p class="px-3 pb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa]">{{ group }}</p>
                @for (item of nav; track item.href) {
                  @if (item.group === group) {
                    <a
                      [routerLink]="item.href"
                      routerLinkActive="bg-[#09090b] font-semibold text-white hover:bg-[#09090b] hover:text-white"
                      [routerLinkActiveOptions]="{ exact: item.exact }"
                      class="mb-0.5 flex min-h-[38px] items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium text-[#52525b] transition-colors duration-150 hover:bg-[#f4f4f1] hover:text-[#09090b]"
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
                            <circle cx="12" cy="12" r="3" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
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

        <div class="shrink-0 border-t border-[#e4e4e7] p-3">
          <div class="rounded-xl border border-[#e4e4e7] bg-white p-1">
            <p class="truncate px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a1a1aa]">{{ workspace()?.name || 'Workspace' }}</p>
            <button type="button" (click)="toggleTheme()" class="flex w-full items-center gap-2 rounded-lg p-2 text-left transition-colors duration-150 hover:bg-[#f7f7f4]">
              <span class="flex size-7 items-center justify-center rounded-full bg-[#121417] font-mono text-[10px] font-semibold text-white">{{ theme() === 'dark' ? 'D' : 'L' }}</span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[12px] font-semibold">Theme: {{ theme() }}</span>
                <span class="block truncate text-[11px] text-[#63676c]">{{ cloud() ? 'Duskly Cloud' : 'Self-host' }}</span>
              </span>
            </button>
          </div>
        </div>
      </aside>

      <div class="flex h-dvh min-w-0 flex-col md:ml-64">
        <header class="sticky top-0 z-20 hidden h-14 shrink-0 items-center justify-between gap-4 border-b border-[#e8e8e3] bg-white/95 px-5 md:flex">
          <h1 class="truncate font-sans text-sm font-semibold">{{ title() }}</h1>
          <div class="flex items-center gap-3">
            <span class="hidden items-center gap-1.5 rounded-md border border-[#e8e8e3] px-2.5 py-1 font-mono text-[11px] font-medium text-[#63676c] lg:inline-flex">
              {{ usage()?.plan || (cloud() ? 'cloud' : 'self-host') }}
            </span>
            <a routerLink="/app/compose" class="inline-flex items-center rounded-md bg-cta px-3 py-1.5 font-mono text-xs font-semibold text-white transition-colors duration-150 hover:bg-cta-hover">
              New post
            </a>
          </div>
        </header>

        <header class="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-2 border-b border-[#e8e8e3] bg-white px-4 md:hidden">
          <a routerLink="/" class="font-display text-[15px] font-bold tracking-tight">Dus<span class="text-cta">kly</span></a>
          <a routerLink="/app/compose" class="inline-flex h-9 items-center rounded-full bg-cta px-3 text-xs font-semibold text-white hover:bg-cta-hover">New</a>
        </header>

        <main class="min-h-0 flex-1 overflow-y-auto px-4 py-5 pb-24 md:px-5 md:py-6 md:pb-6">
          <ng-content />
        </main>
      </div>

      <nav class="fixed inset-x-0 bottom-0 z-40 border-t border-[#e8e8e3] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Mobile navigation">
        <div class="flex h-16 items-center justify-around px-1">
          @for (item of mobileNav; track item.href) {
            <a
              [routerLink]="item.href"
              routerLinkActive="font-semibold text-[#121417]"
              [routerLinkActiveOptions]="{ exact: item.exact }"
              class="relative flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium leading-tight text-[#63676c] transition-colors duration-150"
            >
              <span
                class="absolute top-1 h-[2px] w-5 rounded-full bg-cta opacity-0"
                routerLinkActive="opacity-100"
                [routerLinkActiveOptions]="{ exact: item.exact }"
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
                    <circle cx="12" cy="12" r="3" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2" />
                  }
                }
              </svg>
              <span>{{ item.name }}</span>
            </a>
          }
        </div>
      </nav>
    </div>
  `,
})
export class AppShell implements OnInit {
  readonly nav = NAV;
  readonly groups = ["Schedule", "Workspace"] as const;
  readonly mobileNav = [
    { name: "Calendar", href: "/app", exact: true },
    { name: "Compose", href: "/app/compose", exact: false },
    { name: "Accounts", href: "/app/accounts", exact: false },
    { name: "More", href: "/app/settings", exact: false },
  ] as const;

  workspace = signal<Workspace | null>(null);
  usage = signal<PlanSnapshot | null>(null);
  cloud = signal(false);
  theme = signal<"light" | "dark">("light");
  path = signal("/app");

  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    const sync = () => this.path.set(this.router.url.split("?")[0] || "/app");
    sync();
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => sync());
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
    };
    return titles[this.path()] || "Duskly";
  }

  async ngOnInit() {
    try {
      const data = await api<{ workspace: Workspace; usage: PlanSnapshot; cloud: boolean }>("/v1/workspaces/me");
      this.workspace.set(data.workspace);
      this.usage.set(data.usage);
      this.cloud.set(data.cloud);
      const t = (data.workspace.theme === "dark" ? "dark" : "light") as "light" | "dark";
      this.theme.set(t);
      setDarkClass(t === "dark");
      lsSet("dk-ws", data.workspace.id);
    } catch {
      /* unauthenticated shell still renders */
    }
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
        /* local only */
      }
    }
  }
}
