import { Component, DestroyRef, effect, ElementRef, OnInit, inject, signal, viewChild } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router, RouterOutlet } from "@angular/router";
import { filter } from "rxjs/operators";
import { api, isOnboarded, spaceName, type Workspace } from "../lib/api";
import { lsSet, setDarkClass } from "../lib/browser";
import { Notices } from "../lib/notices";
import { CompanyDesk } from "../lib/company-desk";
import { SessionService } from "../lib/session";
import { ShellNavigation } from "./shell-navigation";
import { ShellNotifications, type AlertPost } from "./shell-notifications";
import { ShellNotices } from "./shell-notices";
import { Spinner } from "../ui/spinner";

@Component({
  selector: "dk-shell",
  standalone: true,
  imports: [RouterOutlet, ShellNavigation, ShellNotifications, ShellNotices, Spinner],
  template: `
    <div class="flex h-dvh flex-col overflow-hidden bg-paper font-sans text-ink dark:bg-zinc-950 dark:text-zinc-100 md:flex-row">
      <a href="#app-content" class="fixed left-4 top-2 z-50 -translate-y-20 rounded-lg bg-ink px-4 py-3 text-white focus:translate-y-0">Skip to content</a>
      <dk-shell-navigation [cloud]="cloud()" [workspace]="label()" [theme]="theme()" [alertCount]="visibleAlerts().length" [alertsError]="!!alertsError()" (review)="notifications.open()" (themeChange)="toggleTheme()" (logout)="signOut()" />
      <div class="flex min-h-0 min-w-0 flex-1 flex-col">
        <main #content id="app-content" tabindex="-1" class="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-8 sm:py-8">
          @if (booting()) {
            <div class="flex min-h-[50vh] items-center justify-center text-cta">
              <dk-spinner [size]="22" label="Loading" [block]="true" />
            </div>
          } @else if (loadError()) {
            <div class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100" role="alert">
              <p>{{ loadError() }}</p>
              <button type="button" (click)="reload()" class="inline-flex h-9 items-center rounded-lg bg-cta px-3 text-xs font-bold text-white hover:bg-cta-hover">Retry</button>
            </div>
          }
          @if (!booting()) {
            <router-outlet />
          }
        </main>
      </div>
      <dk-shell-notifications #notifications [posts]="visibleAlerts()" [error]="alertsError()" (retry)="reloadAlerts()" [company]="desk.current()?.name || ''" />
      <dk-shell-notices />
    </div>
  `,
})
export class AppShell implements OnInit {
  workspace = signal<Workspace | null>(null);
  cloud = signal(false);
  theme = signal<"light" | "dark">("light");
  path = signal("/app");
  loadError = signal("");
  booting = signal(true);
  alertsError = signal("");
  alerts = signal<AlertPost[]>([]);
  readonly notices = inject(Notices);
  readonly notifications = viewChild(ShellNotifications);
  private readonly content = viewChild<ElementRef<HTMLElement>>("content");
  readonly desk = inject(CompanyDesk);

  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly session = inject(SessionService);

  constructor() {
    const sync = () => this.path.set(this.router.url.split(/[?#]/)[0] || "/app");
    sync();
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        const previous = this.path();
        sync();
        const content = this.content()?.nativeElement;
        if (content && previous !== this.path()) content.scrollTop = 0;
        this.notifications()?.close();
      });
    effect(() => {
      this.desk.selectedId();
      const id = this.workspace()?.id;
      if (id) void this.loadAlerts(id);
    });
  }

  async ngOnInit() {
    await this.reload();
  }

  async reload() {
    this.booting.set(true);
    this.loadError.set("");
    try {
      const data = await api<{ workspace: Workspace; cloud: boolean }>("/v1/workspaces/me");
      const role = data.workspace.role;
      if (role !== "member" && role !== "admin" && !isOnboarded(data.workspace)) {
        await this.router.navigateByUrl("/onboarding");
        return;
      }
      this.workspace.set(data.workspace);
      this.cloud.set(data.cloud);
      const t = (data.workspace.theme === "dark" ? "dark" : "light") as "light" | "dark";
      this.theme.set(t);
      setDarkClass(t === "dark");
      lsSet("dk-ws", data.workspace.id);
      await this.desk.load(data.workspace.id);
      await this.loadAlerts(data.workspace.id);
    } catch {
      this.loadError.set("Could not load this workspace. Check that you are signed in and the API is reachable.");
    } finally {
      this.booting.set(false);
    }
  }

  async reloadAlerts() {
    const workspace = this.workspace();
    if (workspace) await this.loadAlerts(workspace.id);
  }

  async loadAlerts(workspaceId: string) {
    try {
      const data = await api<{ posts: AlertPost[] }>(`/v1/posts?${this.desk.scopeQuery(workspaceId)}&issues=1`);
      this.alertsError.set("");
      this.alerts.set(
        (data.posts || []).filter(
          (post) => post.status === "queued" || post.status === "failed" || (post.issues?.length ?? 0) > 0,
        ),
      );
    } catch {
      this.alerts.set([]);
      this.alertsError.set("Could not load publishing notifications. Try again.");
    }
  }

  visibleAlerts() {
    return this.alerts().filter((post) => this.desk.allowsPost((post.channels || []).map((channel) => channel.accountId)));
  }

  label() {
    return spaceName(this.workspace());
  }

  async signOut() {
    try {
      await this.session.signOut();
      await this.router.navigateByUrl("/");
    } catch {
      this.notices.push("error", "Could not sign out. Please try again.");
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
        this.notices.push("error", "Theme saved on this device. The workspace did not update.");
      }
    }
  }
}
