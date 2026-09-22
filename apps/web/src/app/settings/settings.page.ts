import { Component, signal, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AppShell } from "../layout/app-shell";
import { api } from "../lib/api";

@Component({
  standalone: true,
  imports: [AppShell, FormsModule],
  template: `
    <dk-shell>
      <div class="mb-6">
        <p class="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa]">Workspace</p>
        <p class="mt-1 text-[13px] text-[#63676c]">Signatures, posting sets, customer groups, RSS, plugs, API tokens, and integrations.</p>
      </div>

      <section class="mb-4 rounded-xl border border-[#e8e8e3] bg-white p-4">
        <p class="mb-3 font-mono text-[10px] uppercase tracking-wider text-[#92969b]">Signatures</p>
        <div class="mb-3 flex flex-wrap gap-2">
          <input [(ngModel)]="sigName" placeholder="Name" class="h-10 rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm outline-none focus:border-[#121417] focus:bg-white" />
          <input [(ngModel)]="sigBody" placeholder="— via Duskly" class="h-10 min-w-[12rem] flex-1 rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm outline-none focus:border-[#121417] focus:bg-white" />
          <button type="button" (click)="addSig()" class="h-10 rounded-md bg-cta px-3 text-xs font-semibold text-white hover:bg-cta-hover">Add</button>
        </div>
        @for (s of signatures(); track s.id) {
          <p class="mb-2 rounded-lg border border-[#e8e8e3] px-3 py-2 text-[13px]">{{ s.name }}: {{ s.body }}</p>
        }
      </section>

      <section class="mb-4 rounded-xl border border-[#e8e8e3] bg-white p-4">
        <p class="mb-3 font-mono text-[10px] uppercase tracking-wider text-[#92969b]">Customer groups</p>
        <div class="mb-3 flex gap-2">
          <input [(ngModel)]="groupName" placeholder="Client / brand" class="h-10 flex-1 rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm outline-none focus:border-[#121417] focus:bg-white" />
          <button type="button" (click)="addGroup()" class="h-10 rounded-md bg-cta px-3 text-xs font-semibold text-white hover:bg-cta-hover">Add</button>
        </div>
        @for (g of groups(); track g.id) {
          <p class="mb-2 rounded-lg border border-[#e8e8e3] px-3 py-2 text-[13px]">{{ g.name }}</p>
        }
      </section>

      <section class="mb-4 rounded-xl border border-[#e8e8e3] bg-white p-4">
        <p class="mb-3 font-mono text-[10px] uppercase tracking-wider text-[#92969b]">RSS auto-post</p>
        <div class="mb-3 flex flex-wrap gap-2">
          <input [(ngModel)]="rssUrl" placeholder="https://blog.example.com/feed" class="h-10 min-w-[16rem] flex-1 rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm outline-none focus:border-[#121417] focus:bg-white" />
          <button type="button" (click)="addRss()" class="h-10 rounded-md bg-cta px-3 text-xs font-semibold text-white hover:bg-cta-hover">Watch feed</button>
        </div>
        @for (f of feeds(); track f.id) {
          <p class="mb-2 truncate rounded-lg border border-[#e8e8e3] px-3 py-2 text-[13px]">{{ f.url }}</p>
        }
      </section>

      <section class="mb-4 rounded-xl border border-[#e8e8e3] bg-white p-4">
        <p class="mb-3 font-mono text-[10px] uppercase tracking-wider text-[#92969b]">Plugs</p>
        <div class="mb-3 grid gap-2 sm:grid-cols-2">
          <input [(ngModel)]="plugName" placeholder="Plug name" class="h-10 rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm outline-none focus:border-[#121417] focus:bg-white" />
          <input [(ngModel)]="plugBody" placeholder="Post body when triggered" class="h-10 rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm outline-none focus:border-[#121417] focus:bg-white" />
        </div>
        <div class="mb-3 flex gap-2">
          <button type="button" (click)="addPlug('internal')" class="h-9 rounded-md border border-[#e8e8e3] px-3 text-xs font-semibold hover:bg-[#f7f7f4]">Add internal</button>
          <button type="button" (click)="addPlug('global')" class="h-9 rounded-md border border-[#e8e8e3] px-3 text-xs font-semibold hover:bg-[#f7f7f4]">Add global</button>
        </div>
        @for (p of plugs(); track p.id) {
          <div class="mb-2 flex justify-between rounded-lg border border-[#e8e8e3] px-3 py-2 text-[13px]">
            <span>{{ p.scope }} · {{ p.name }}</span>
            <button type="button" (click)="runPlug(p.id)" class="text-xs font-semibold text-cta">Run</button>
          </div>
        }
      </section>

      <section class="mb-4 rounded-xl border border-[#e8e8e3] bg-white p-4">
        <p class="mb-3 font-mono text-[10px] uppercase tracking-wider text-[#92969b]">API tokens</p>
        <button type="button" (click)="createToken()" class="mb-3 h-9 rounded-md bg-[#121417] px-3 text-xs font-semibold text-white hover:bg-[#27272a]">Create token</button>
        @if (newToken()) {
          <p class="mb-2 break-all rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs">Copy now: {{ newToken() }}</p>
        }
        @for (t of tokens(); track t.id) {
          <p class="font-mono text-xs text-[#63676c]">{{ t.tokenPrefix }}… · {{ t.name }}</p>
        }
      </section>

      <section class="rounded-xl border border-[#e8e8e3] bg-white p-4">
        <p class="mb-3 font-mono text-[10px] uppercase tracking-wider text-[#92969b]">Integrations (webhooks)</p>
        <div class="mb-3 flex flex-wrap gap-2">
          <input [(ngModel)]="hookName" placeholder="Name" class="h-10 rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm outline-none focus:border-[#121417] focus:bg-white" />
          <input [(ngModel)]="hookUrl" placeholder="https://example.com/hook" class="h-10 min-w-[14rem] flex-1 rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm outline-none focus:border-[#121417] focus:bg-white" />
          <button type="button" (click)="addHook()" class="h-10 rounded-md bg-cta px-3 text-xs font-semibold text-white hover:bg-cta-hover">Add</button>
        </div>
        @for (h of hooks(); track h.id) {
          <p class="mb-2 truncate rounded-lg border border-[#e8e8e3] px-3 py-2 text-[13px]">{{ h.name }} · {{ h.url }}</p>
        }
      </section>
    </dk-shell>
  `,
})
export class SettingsPage implements OnInit {
  workspaceId = "";
  channelId = "";
  sigName = "";
  sigBody = "";
  groupName = "";
  rssUrl = "";
  plugName = "";
  plugBody = "";
  hookName = "";
  hookUrl = "";
  signatures = signal<{ id: string; name: string; body: string }[]>([]);
  groups = signal<{ id: string; name: string }[]>([]);
  feeds = signal<{ id: string; url: string }[]>([]);
  plugs = signal<{ id: string; name: string; scope: string }[]>([]);
  tokens = signal<{ id: string; name: string; tokenPrefix: string }[]>([]);
  hooks = signal<{ id: string; name: string; url: string }[]>([]);
  newToken = signal("");

  async ngOnInit() {
    try {
      const me = await api<{ workspace: { id: string } }>("/v1/workspaces/me");
      this.workspaceId = me.workspace.id;
      const ac = await api<{ accounts: { id: string }[] }>(`/v1/accounts?workspaceId=${this.workspaceId}`);
      this.channelId = ac.accounts[0]?.id || "";
      await this.reload();
    } catch {
      /* unauthenticated */
    }
  }

  async reload() {
    const w = this.workspaceId;
    const [sigs, groups, feeds, plugs, tokens, hooks] = await Promise.all([
      api<{ signatures: { id: string; name: string; body: string }[] }>(`/v1/org/signatures?workspaceId=${w}`),
      api<{ groups: { id: string; name: string }[] }>(`/v1/org/groups?workspaceId=${w}`),
      api<{ feeds: { id: string; url: string }[] }>(`/v1/org/rss?workspaceId=${w}`),
      api<{ plugs: { id: string; name: string; scope: string }[] }>(`/v1/org/plugs?workspaceId=${w}`),
      api<{ tokens: { id: string; name: string; tokenPrefix: string }[] }>(`/v1/org/tokens?workspaceId=${w}`),
      api<{ integrations: { id: string; name: string; url: string }[] }>(`/v1/org/integrations?workspaceId=${w}`),
    ]);
    this.signatures.set(sigs.signatures);
    this.groups.set(groups.groups);
    this.feeds.set(feeds.feeds);
    this.plugs.set(plugs.plugs);
    this.tokens.set(tokens.tokens);
    this.hooks.set(hooks.integrations);
  }

  async addSig() {
    await api("/v1/org/signatures", { method: "POST", json: { workspaceId: this.workspaceId, name: this.sigName, body: this.sigBody } });
    this.sigName = "";
    this.sigBody = "";
    await this.reload();
  }
  async addGroup() {
    await api("/v1/org/groups", { method: "POST", json: { workspaceId: this.workspaceId, name: this.groupName } });
    this.groupName = "";
    await this.reload();
  }
  async addRss() {
    if (!this.channelId) return;
    await api("/v1/org/rss", {
      method: "POST",
      json: { workspaceId: this.workspaceId, url: this.rssUrl, channelIds: [this.channelId] },
    });
    this.rssUrl = "";
    await this.reload();
  }
  async addPlug(scope: "internal" | "global") {
    await api("/v1/org/plugs", {
      method: "POST",
      json: {
        workspaceId: this.workspaceId,
        scope,
        name: this.plugName,
        triggerType: "manual",
        action: { type: "create_post", body: this.plugBody || "Plug fired", channelId: this.channelId || undefined },
      },
    });
    this.plugName = "";
    this.plugBody = "";
    await this.reload();
  }
  async runPlug(id: string) {
    await api(`/v1/org/plugs/${id}/run?workspaceId=${this.workspaceId}`, { method: "POST" });
  }
  async createToken() {
    const r = await api<{ token: string }>("/v1/org/tokens", {
      method: "POST",
      json: { workspaceId: this.workspaceId, name: "CLI" },
    });
    this.newToken.set(r.token);
    await this.reload();
  }
  async addHook() {
    await api("/v1/org/integrations", {
      method: "POST",
      json: { workspaceId: this.workspaceId, name: this.hookName, url: this.hookUrl },
    });
    this.hookName = "";
    this.hookUrl = "";
    await this.reload();
  }
}
