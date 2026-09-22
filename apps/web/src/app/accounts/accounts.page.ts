import { Component, signal, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AppShell } from "../layout/app-shell";
import { api } from "../lib/api";

@Component({
  standalone: true,
  imports: [AppShell, FormsModule],
  template: `
    <dk-shell>
      <div class="mb-5">
        <p class="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa]">Workspace</p>
        <p class="mt-1 text-[13px] text-[#63676c]">Connect channels this workspace can schedule to. Bluesky can publish with an app password; others queue until OAuth is configured.</p>
      </div>

      @if (msg()) {
        <p class="mb-4 rounded-xl border border-[#e8e8e3] bg-white px-4 py-3 text-[13px]">{{ msg() }}</p>
      }

      <form class="mb-6 grid gap-3 rounded-xl border border-[#e8e8e3] bg-white p-4 sm:grid-cols-2" (ngSubmit)="connect()">
        <label class="text-[11px] font-semibold text-[#71717a]">Network
          <select [(ngModel)]="network" name="network" class="mt-1 h-10 w-full rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm font-normal outline-none focus:border-[#121417] focus:bg-white">
            @for (n of networks(); track n) { <option [value]="n">{{ n }}</option> }
          </select>
        </label>
        <label class="text-[11px] font-semibold text-[#71717a]">Handle
          <input [(ngModel)]="handle" name="handle" required class="mt-1 h-10 w-full rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm font-normal outline-none focus:border-[#121417] focus:bg-white" />
        </label>
        <label class="text-[11px] font-semibold text-[#71717a] sm:col-span-2">App password (Bluesky)
          <input [(ngModel)]="appPassword" name="pass" type="password" class="mt-1 h-10 w-full rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm font-normal outline-none focus:border-[#121417] focus:bg-white" />
        </label>
        <button type="submit" class="inline-flex h-10 items-center justify-center rounded-md bg-cta px-4 text-sm font-semibold text-white hover:bg-cta-hover sm:col-span-2">Connect</button>
      </form>

      <div class="space-y-2">
        @for (a of accounts(); track a.id) {
          <div class="flex items-center justify-between rounded-xl border border-[#e8e8e3] bg-white px-4 py-3">
            <div>
              <p class="text-[13px] font-semibold">{{ a.handle }}</p>
              <p class="font-mono text-[11px] text-[#a1a1aa]">{{ a.network }} · {{ a.status }}</p>
            </div>
            <button type="button" (click)="remove(a.id)" class="text-xs font-semibold text-red-600">Remove</button>
          </div>
        }
      </div>
    </dk-shell>
  `,
})
export class AccountsPage implements OnInit {
  accounts = signal<{ id: string; network: string; handle: string; status: string }[]>([]);
  networks = signal<string[]>(["bluesky", "x", "linkedin", "mastodon"]);
  network = "bluesky";
  handle = "";
  appPassword = "";
  workspaceId = "";
  msg = signal("");

  async ngOnInit() {
    const me = await api<{ workspace: { id: string } }>("/v1/workspaces/me");
    this.workspaceId = me.workspace.id;
    await this.reload();
  }

  async reload() {
    const data = await api<{ accounts: { id: string; network: string; handle: string; status: string }[]; networks: string[] }>(
      `/v1/accounts?workspaceId=${this.workspaceId}`,
    );
    this.accounts.set(data.accounts);
    this.networks.set(data.networks);
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
