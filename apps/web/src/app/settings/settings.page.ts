import { Component, signal, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { api } from "../lib/api";

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="mx-auto max-w-5xl">
      <div class="mb-6">
        <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-cta">Workspace</p>
        <h1 class="mt-1 font-display text-3xl font-bold tracking-tight dark:text-zinc-50">Settings</h1>
        <p class="mt-1 max-w-xl text-sm text-[#63676c] dark:text-zinc-400">Signatures, posting sets, customer groups, RSS, plugs, API tokens, and integrations.</p>
      </div>

      <section class="mb-4 rounded-xl border border-[#e8e8e3] bg-white p-4 shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
        <p class="mb-3 font-mono text-[10px] uppercase tracking-wider text-[#92969b] dark:text-zinc-500">Signatures</p>
        <div class="mb-3 flex flex-wrap gap-2">
          <input [(ngModel)]="sigName" placeholder="Name" class="h-10 rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm outline-none focus:border-[#121417] focus:bg-white dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" />
          <input [(ngModel)]="sigBody" placeholder="— via Duskly" class="h-10 min-w-[12rem] flex-1 rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm outline-none focus:border-[#121417] focus:bg-white dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" />
          <label class="flex items-center gap-1.5 text-xs text-[#63676c] dark:text-zinc-400">
            <input type="checkbox" [(ngModel)]="sigDefault" class="accent-cta" /> Default
          </label>
          <button type="button" (click)="addSig()" class="h-10 rounded-full bg-cta px-4 text-xs font-semibold text-white hover:bg-cta-hover">Add</button>
        </div>
        @for (s of signatures(); track s.id) {
          <div class="mb-2 flex items-center justify-between rounded-lg border border-[#e8e8e3] px-3 py-2 text-[13px] dark:border-zinc-700 dark:text-zinc-200">
            <span>{{ s.name }}: {{ s.body }}{{ s.isDefault ? ' · default' : '' }}</span>
            @if (!s.isDefault) {
              <button type="button" (click)="setDefaultSig(s.id)" class="text-xs font-semibold text-cta">Set default</button>
            }
          </div>
        } @empty {
          <p class="text-[12px] text-[#63676c] dark:text-zinc-400">No signatures yet.</p>
        }
      </section>

      <section class="mb-4 rounded-xl border border-[#e8e8e3] bg-white p-4 shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
        <p class="mb-3 font-mono text-[10px] uppercase tracking-wider text-[#92969b] dark:text-zinc-500">Posting sets</p>
        <div class="mb-3 grid gap-2 sm:grid-cols-2">
          <input [(ngModel)]="setName" placeholder="Set name" class="h-10 rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" />
          <input [(ngModel)]="setTemplate" placeholder="Optional template body" class="h-10 rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" />
        </div>
        <p class="mb-2 text-[11px] text-[#63676c] dark:text-zinc-400">Channels in this set</p>
        @for (a of accounts(); track a.id) {
          <label class="mr-3 inline-flex items-center gap-1.5 text-[12px] dark:text-zinc-300">
            <input type="checkbox" [checked]="setChannels().includes(a.id)" (change)="toggleSetChannel(a.id)" class="accent-cta" />
            {{ a.network }} · {{ a.handle }}
          </label>
        }
        <div class="mt-3">
          <button type="button" (click)="addSet()" class="h-10 rounded-full bg-cta px-4 text-xs font-semibold text-white hover:bg-cta-hover">Create set</button>
        </div>
        @for (s of sets(); track s.id) {
          <p class="mt-2 rounded-lg border border-[#e8e8e3] px-3 py-2 text-[13px] dark:border-zinc-700 dark:text-zinc-200">{{ s.name }} · {{ channelCount(s.channelIds) }} channels</p>
        }
      </section>

      <section class="mb-4 rounded-xl border border-[#e8e8e3] bg-white p-4 shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
        <p class="mb-3 font-mono text-[10px] uppercase tracking-wider text-[#92969b] dark:text-zinc-500">Customer groups</p>
        <div class="mb-3 flex gap-2">
          <input [(ngModel)]="groupName" placeholder="Client / brand" class="h-10 flex-1 rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm outline-none focus:border-[#121417] focus:bg-white dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" />
          <button type="button" (click)="addGroup()" class="h-10 rounded-full bg-cta px-4 text-xs font-semibold text-white hover:bg-cta-hover">Add</button>
        </div>
        @for (g of groups(); track g.id) {
          <p class="mb-2 rounded-lg border border-[#e8e8e3] px-3 py-2 text-[13px] dark:border-zinc-700 dark:text-zinc-200">{{ g.name }}</p>
        }
      </section>

      <section class="mb-4 rounded-xl border border-[#e8e8e3] bg-white p-4 shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
        <p class="mb-3 font-mono text-[10px] uppercase tracking-wider text-[#92969b] dark:text-zinc-500">RSS auto-post</p>
        <div class="mb-3 flex flex-wrap gap-2">
          <input [(ngModel)]="rssUrl" placeholder="https://blog.example.com/feed" class="h-10 min-w-[16rem] flex-1 rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm outline-none focus:border-[#121417] focus:bg-white dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" />
          <button type="button" (click)="addRss()" class="h-10 rounded-full bg-cta px-4 text-xs font-semibold text-white hover:bg-cta-hover">Watch feed</button>
        </div>
        @for (f of feeds(); track f.id) {
          <p class="mb-2 truncate rounded-lg border border-[#e8e8e3] px-3 py-2 text-[13px] dark:border-zinc-700 dark:text-zinc-200">{{ f.url }}</p>
        }
      </section>

      <section class="mb-4 rounded-xl border border-[#e8e8e3] bg-white p-4 shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
        <p class="mb-3 font-mono text-[10px] uppercase tracking-wider text-[#92969b] dark:text-zinc-500">Plugs</p>
        <div class="mb-3 grid gap-2 sm:grid-cols-2">
          <input [(ngModel)]="plugName" placeholder="Plug name" class="h-10 rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" />
          <input [(ngModel)]="plugBody" placeholder="Post body when triggered" class="h-10 rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" />
          <label class="text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Trigger
            <select [(ngModel)]="plugTrigger" class="mt-1 h-10 w-full rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm font-normal outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100">
              <option value="manual">Manual</option>
              <option value="on_publish">On publish</option>
              <option value="schedule">Schedule</option>
            </select>
          </label>
          @if (plugTrigger === 'schedule') {
            <label class="text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Every (minutes)
              <input type="number" [(ngModel)]="plugEvery" min="15" class="mt-1 h-10 w-full rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm font-normal outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" />
            </label>
          }
        </div>
        <div class="mb-3 flex gap-2">
          <button type="button" (click)="addPlug('internal')" class="h-9 rounded-md border border-[#e8e8e3] px-3 text-xs font-semibold hover:bg-[#f7f7f4] dark:border-zinc-600 dark:hover:bg-zinc-800">Add internal</button>
          <button type="button" (click)="addPlug('global')" class="h-9 rounded-md border border-[#e8e8e3] px-3 text-xs font-semibold hover:bg-[#f7f7f4] dark:border-zinc-600 dark:hover:bg-zinc-800">Add global</button>
        </div>
        @for (p of plugs(); track p.id) {
          <div class="mb-2 flex justify-between rounded-lg border border-[#e8e8e3] px-3 py-2 text-[13px] dark:border-zinc-700 dark:text-zinc-200">
            <span>{{ p.scope }} · {{ p.triggerType }} · {{ p.name }}</span>
            <button type="button" (click)="runPlug(p.id)" class="text-xs font-semibold text-cta">Run</button>
          </div>
        }
      </section>

      <section class="mb-4 rounded-xl border border-[#e8e8e3] bg-white p-4 shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
        <p class="mb-3 font-mono text-[10px] uppercase tracking-wider text-[#92969b] dark:text-zinc-500">API tokens</p>
        <button type="button" (click)="createToken()" class="mb-3 h-9 rounded-full bg-[#121417] px-4 text-xs font-semibold text-white hover:bg-[#27272a] dark:bg-zinc-100 dark:text-zinc-900">Create token</button>
        @if (newToken()) {
          <p class="mb-2 break-all rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">Copy now: {{ newToken() }}</p>
        }
        @for (t of tokens(); track t.id) {
          <p class="font-mono text-xs text-[#63676c] dark:text-zinc-400">{{ t.tokenPrefix }}… · {{ t.name }}</p>
        }
      </section>

      <section class="rounded-xl border border-[#e8e8e3] bg-white p-4 shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
        <p class="mb-3 font-mono text-[10px] uppercase tracking-wider text-[#92969b] dark:text-zinc-500">Integrations (webhooks)</p>
        <div class="mb-3 flex flex-wrap gap-2">
          <input [(ngModel)]="hookName" placeholder="Name" class="h-10 rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm outline-none focus:border-[#121417] focus:bg-white dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" />
          <input [(ngModel)]="hookUrl" placeholder="https://example.com/hook" class="h-10 min-w-[14rem] flex-1 rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm outline-none focus:border-[#121417] focus:bg-white dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" />
          <button type="button" (click)="addHook()" class="h-10 rounded-full bg-cta px-4 text-xs font-semibold text-white hover:bg-cta-hover">Add</button>
        </div>
        @for (h of hooks(); track h.id) {
          <p class="mb-2 truncate rounded-lg border border-[#e8e8e3] px-3 py-2 text-[13px] dark:border-zinc-700 dark:text-zinc-200">{{ h.name }} · {{ h.url }}</p>
        }
      </section>
    </div>
  `,
})
export class SettingsPage implements OnInit {
  workspaceId = "";
  channelId = "";
  sigName = "";
  sigBody = "";
  sigDefault = false;
  setName = "";
  setTemplate = "";
  groupName = "";
  rssUrl = "";
  plugName = "";
  plugBody = "";
  plugTrigger: "manual" | "on_publish" | "schedule" = "manual";
  plugEvery = 60;
  hookName = "";
  hookUrl = "";
  signatures = signal<{ id: string; name: string; body: string; isDefault: boolean }[]>([]);
  sets = signal<{ id: string; name: string; channelIds: string }[]>([]);
  accounts = signal<{ id: string; network: string; handle: string }[]>([]);
  setChannels = signal<string[]>([]);
  groups = signal<{ id: string; name: string }[]>([]);
  feeds = signal<{ id: string; url: string }[]>([]);
  plugs = signal<{ id: string; name: string; scope: string; triggerType: string }[]>([]);
  tokens = signal<{ id: string; name: string; tokenPrefix: string }[]>([]);
  hooks = signal<{ id: string; name: string; url: string }[]>([]);
  newToken = signal("");

  async ngOnInit() {
    try {
      const me = await api<{ workspace: { id: string } }>("/v1/workspaces/me");
      this.workspaceId = me.workspace.id;
      const ac = await api<{ accounts: { id: string; network: string; handle: string }[] }>(
        `/v1/accounts?workspaceId=${this.workspaceId}`,
      );
      this.accounts.set(ac.accounts);
      this.channelId = ac.accounts[0]?.id || "";
      await this.reload();
    } catch {
      /* unauthenticated */
    }
  }

  async reload() {
    const w = this.workspaceId;
    const [sigs, sets, groups, feeds, plugs, tokens, hooks] = await Promise.all([
      api<{ signatures: { id: string; name: string; body: string; isDefault: boolean }[] }>(`/v1/org/signatures?workspaceId=${w}`),
      api<{ sets: { id: string; name: string; channelIds: string }[] }>(`/v1/org/sets?workspaceId=${w}`),
      api<{ groups: { id: string; name: string }[] }>(`/v1/org/groups?workspaceId=${w}`),
      api<{ feeds: { id: string; url: string }[] }>(`/v1/org/rss?workspaceId=${w}`),
      api<{ plugs: { id: string; name: string; scope: string; triggerType: string }[] }>(`/v1/org/plugs?workspaceId=${w}`),
      api<{ tokens: { id: string; name: string; tokenPrefix: string }[] }>(`/v1/org/tokens?workspaceId=${w}`),
      api<{ integrations: { id: string; name: string; url: string }[] }>(`/v1/org/integrations?workspaceId=${w}`),
    ]);
    this.signatures.set(sigs.signatures);
    this.sets.set(sets.sets);
    this.groups.set(groups.groups);
    this.feeds.set(feeds.feeds);
    this.plugs.set(plugs.plugs);
    this.tokens.set(tokens.tokens);
    this.hooks.set(hooks.integrations);
  }

  toggleSetChannel(id: string) {
    const s = new Set(this.setChannels());
    if (s.has(id)) s.delete(id);
    else s.add(id);
    this.setChannels.set([...s]);
  }

  channelCount(json: string) {
    try {
      return (JSON.parse(json) as string[]).length;
    } catch {
      return 0;
    }
  }

  async addSig() {
    await api("/v1/org/signatures", {
      method: "POST",
      json: { workspaceId: this.workspaceId, name: this.sigName, body: this.sigBody, isDefault: this.sigDefault },
    });
    this.sigName = "";
    this.sigBody = "";
    this.sigDefault = false;
    await this.reload();
  }

  async setDefaultSig(id: string) {
    await api(`/v1/org/signatures/${id}/default?workspaceId=${this.workspaceId}`, { method: "POST" });
    await this.reload();
  }

  async addSet() {
    if (!this.setChannels().length) return;
    await api("/v1/org/sets", {
      method: "POST",
      json: {
        workspaceId: this.workspaceId,
        name: this.setName,
        channelIds: this.setChannels(),
        templateBody: this.setTemplate || undefined,
      },
    });
    this.setName = "";
    this.setTemplate = "";
    this.setChannels.set([]);
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
        triggerType: this.plugTrigger,
        action: {
          type: "create_post",
          body: this.plugBody || "Plug fired",
          channelId: this.channelId || undefined,
          everyMinutes: this.plugTrigger === "schedule" ? this.plugEvery : undefined,
        },
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
