import { Component, signal } from "@angular/core";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { MarketingFooter } from "../layout/marketing-footer";

const NAV = [
  {
    label: "Get started",
    items: [{ label: "Overview", path: "/docs" }],
  },
  {
    label: "API",
    items: [{ label: "Authentication & endpoints", path: "/docs/api" }],
  },
  {
    label: "Agents",
    items: [
      { label: "Smart agent & API", path: "/docs/agents" },
      { label: "MCP", path: "/docs/mcp" },
    ],
  },
];

@Component({
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, MarketingFooter],
  template: `
    <div class="flex min-h-dvh flex-col bg-[#fbfbfa] font-sans text-[#09090b] antialiased">
      <header class="sticky top-0 z-40 border-b border-[#e4e4e7] bg-[#fbfbfa]/95 backdrop-blur-md">
        <div class="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6">
          <div class="flex items-center gap-4">
            <a routerLink="/" class="font-display text-[17px] font-extrabold tracking-tight">
              Dus<span class="text-cta">kly</span>
            </a>
            <span class="hidden h-4 w-px bg-[#e4e4e7] sm:block"></span>
            <span class="hidden font-mono text-[12px] font-semibold text-[#52525b] sm:inline">Docs</span>
          </div>
          <div class="flex items-center gap-3">
            <a routerLink="/" class="hidden text-[13px] font-medium text-[#52525b] hover:text-[#09090b] sm:inline">Home</a>
            <a routerLink="/signin" class="inline-flex h-8 items-center rounded-full bg-cta px-3.5 text-[12px] font-semibold text-white hover:bg-cta-hover">Sign in</a>
            <button
              type="button"
              class="flex size-9 items-center justify-center text-[#52525b] lg:hidden"
              [attr.aria-expanded]="navOpen()"
              (click)="navOpen.set(!navOpen())"
            >
              <span class="sr-only">Docs menu</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                @if (navOpen()) {
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                } @else {
                  <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                }
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div class="mx-auto flex w-full max-w-[1400px] flex-1">
        <aside
          class="fixed inset-y-0 left-0 z-30 w-64 shrink-0 overflow-y-auto border-r border-[#e4e4e7] bg-[#fbfbfa] pt-14 transition-transform lg:static lg:translate-x-0 lg:pt-0"
          [class.-translate-x-full]="!navOpen()"
          [class.translate-x-0]="navOpen()"
        >
          <nav class="space-y-6 px-4 py-8 sm:px-5">
            @for (group of nav; track group.label) {
              <div>
                <p class="mb-2 px-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-[#71717a]">{{ group.label }}</p>
                <ul class="space-y-0.5">
                  @for (item of group.items; track item.path) {
                    <li>
                      <a
                        [routerLink]="item.path"
                        routerLinkActive="bg-white text-[#09090b] shadow-sm"
                        [routerLinkActiveOptions]="{ exact: item.path === '/docs' }"
                        (click)="navOpen.set(false)"
                        class="block rounded-md px-2 py-1.5 text-[13px] font-medium text-[#52525b] hover:bg-white hover:text-[#09090b]"
                      >{{ item.label }}</a>
                    </li>
                  }
                </ul>
              </div>
            }
          </nav>
        </aside>

        @if (navOpen()) {
          <button type="button" class="fixed inset-0 z-20 bg-black/20 lg:hidden" aria-label="Close menu" (click)="navOpen.set(false)"></button>
        }

        <main class="min-w-0 flex-1 px-4 py-10 sm:px-8 lg:px-10">
          <router-outlet />
        </main>
      </div>
      <dk-marketing-footer />
    </div>
  `,
})
export class DocsShell {
  readonly nav = NAV;
  readonly navOpen = signal(false);
}
