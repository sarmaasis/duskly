import { Component, signal, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { api, apiBase } from "../lib/api";

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="mx-auto max-w-5xl">
      <div class="mb-6">
        <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-cta">Workspace</p>
        <h1 class="mt-1 font-display text-3xl font-bold tracking-tight dark:text-zinc-50">Accounts</h1>
        <p class="mt-1 max-w-xl text-sm text-[#63676c] dark:text-zinc-400">Connect channels. Bluesky uses an app password; X, LinkedIn, and Mastodon use OAuth when client credentials are configured on the API.</p>
      </div>

      @if (msg()) {
        <p class="mb-4 rounded-xl border border-[#e8e8e3] bg-white px-4 py-3 text-[13px] shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">{{ msg() }}</p>
      }

      <form class="mb-6 grid gap-3 rounded-xl border border-[#e8e8e3] bg-white p-4 shadow-[0_1px_3px_rgba(15,18,24,0.06)] sm:grid-cols-2 dark:border-zinc-700 dark:bg-zinc-900" (ngSubmit)="connect()">
        <label class="text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Network
          <select [(ngModel)]="network" name="network" class="mt-1 h-10 w-full rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm font-normal outline-none focus:border-[#121417] focus:bg-white dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100">
            @for (n of networks(); track n) { <option [value]="n">{{ n }}</option> }
          </select>
        </label>
        @if (network === 'bluesky') {
          <label class="text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Handle
            <input [(ngModel)]="handle" name="handle" required class="mt-1 h-10 w-full rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm font-normal outline-none focus:border-[#121417] focus:bg-white dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" />
          </label>
          <label class="text-[11px] font-semibold text-[#71717a] sm:col-span-2 dark:text-zinc-400">App password
            <input [(ngModel)]="appPassword" name="pass" type="password" class="mt-1 h-10 w-full rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm font-normal outline-none focus:border-[#121417] focus:bg-white dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" />
          </label>
          <button type="submit" class="inline-flex h-10 items-center justify-center rounded-full bg-cta px-5 text-sm font-semibold text-white hover:bg-cta-hover sm:col-span-2">Connect Bluesky</button>
        } @else {
          @if (network === 'mastodon') {
            <label class="text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Instance URL
              <input [(ngModel)]="mastodonInstance" name="instance" class="mt-1 h-10 w-full rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm font-normal outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" />
            </label>
          }
          <button type="button" (click)="oauthConnect()" class="inline-flex h-10 items-center justify-center rounded-full bg-cta px-5 text-sm font-semibold text-white hover:bg-cta-hover sm:col-span-2">
            Connect with {{ network }} OAuth
          </button>
          @if (!oauthReady()[network]) {
            <p class="text-[12px] text-amber-700 sm:col-span-2 dark:text-amber-400">API OAuth credentials for {{ network }} are not configured — the start endpoint will return a clear config error (no fake success).</p>
          }
        }
      </form>

      <div class="space-y-2">
        @for (a of accounts(); track a.id) {
          <div class="flex items-center justify-between rounded-xl border border-[#e8e8e3] bg-white px-4 py-3 shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
            <div>
              <p class="text-[13px] font-semibold dark:text-zinc-100">{{ a.handle }}</p>
              <p class="font-mono text-[11px] text-[#a1a1aa] dark:text-zinc-500">{{ a.network }} · {{ a.status }}</p>
            </div>
            <button type="button" (click)="remove(a.id)" class="text-xs font-semibold text-red-600">Remove</button>
          </div>
        } @empty {
          <div class="rounded-xl border border-[#e8e8e3] bg-white p-6 shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
            <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-cta">No channels</p>
            <h2 class="mt-2 font-display text-lg font-semibold dark:text-zinc-100">Connect your first account</h2>
            <p class="mt-2 text-sm text-[#63676c] dark:text-zinc-400">Bluesky, X, LinkedIn, or Mastodon — then compose can cross-post.</p>
          </div>
        }
      </div>
    </div>
  `,
})
export class AccountsPage implements OnInit {
  accounts = signal<{ id: string; network: string; handle: string; status: string }[]>([]);
  networks = signal<string[]>(["bluesky", "x", "linkedin", "mastodon"]);
  oauthReady = signal<Record<string, boolean>>({ x: false, linkedin: false, mastodon: false, bluesky: true });
  network = "bluesky";
  handle = "";
  appPassword = "";
  mastodonInstance = "https://mastodon.social";
  workspaceId = "";
  msg = signal("");

  constructor(private route: ActivatedRoute) {}

  async ngOnInit() {
    try {
      const me = await api<{ workspace: { id: string } }>("/v1/workspaces/me");
      this.workspaceId = me.workspace.id;
      const oauth = this.route.snapshot.queryParamMap.get("oauth");
      if (oauth === "ok") this.msg.set("OAuth connected");
      else if (oauth === "error" || oauth === "token_failed") this.msg.set("OAuth failed — credentials or consent rejected");
      else if (oauth === "expired") this.msg.set("OAuth state expired — try again");
      await this.reload();
      try {
        const st = await api<Record<string, boolean>>(`/v1/accounts/oauth/status?workspaceId=${this.workspaceId}`);
        this.oauthReady.set({ ...this.oauthReady(), ...st });
      } catch {
        /* ignore */
      }
    } catch {
      this.msg.set("Sign in to connect accounts.");
    }
  }

  async reload() {
    const data = await api<{ accounts: { id: string; network: string; handle: string; status: string }[]; networks: string[] }>(
      `/v1/accounts?workspaceId=${this.workspaceId}`,
    );
    this.accounts.set(data.accounts);
    this.networks.set(data.networks);
  }

  oauthConnect() {
    const q = new URLSearchParams({ workspaceId: this.workspaceId });
    if (this.network === "mastodon") q.set("instance", this.mastodonInstance);
    window.location.href = `${apiBase()}/v1/accounts/oauth/${this.network}/start?${q}`;
  }

  async connect() {
    try {
      await api("/v1/accounts", {
        method: "POST",
        json: {
          workspaceId: this.workspaceId,
          network: this.network,
          handle: this.handle,
          appPassword: this.appPassword || undefined,
        },
      });
      this.handle = "";
      this.appPassword = "";
      this.msg.set("Channel connected");
      await this.reload();
    } catch (e: unknown) {
      const err = e as { body?: { message?: string }; message?: string };
      this.msg.set(err.body?.message || err.message || "Failed");
    }
  }

  async remove(id: string) {
    await api(`/v1/accounts/${id}?workspaceId=${this.workspaceId}`, { method: "DELETE" });
    await this.reload();
  }
}
