import { Component, signal, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { api } from "../lib/api";
import { DkChoice, DkPill, DkSelect, FIELD } from "../ui/forms";

@Component({
  standalone: true,
  imports: [FormsModule, DkSelect, DkChoice, DkPill],
  template: `
    <div class="mx-auto max-w-5xl">
      <div class="mb-6">
        <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-cta">Account</p>
        <h1 class="mt-1 font-display text-3xl font-bold tracking-tight dark:text-zinc-50">Settings</h1>
        <p class="mt-1 max-w-xl text-sm text-[#63676c] dark:text-zinc-400">Signatures, posting sets, customer groups, RSS, plugs, API tokens, and integrations.</p>
      </div>

      <section class="mb-4 rounded-xl border border-[#e8e8e3] bg-white p-4 shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
        <p class="mb-3 font-mono text-[10px] uppercase tracking-wider text-[#92969b] dark:text-zinc-500">Signatures</p>
        <div class="mb-3 flex flex-wrap gap-2">
          <input [(ngModel)]="sigName" placeholder="Name" [class]="field" />
          <input [(ngModel)]="sigBody" placeholder="— via Duskly" [class]="field + ' min-w-[12rem] flex-1'" />
          <div class="flex min-w-[14rem] gap-2" role="radiogroup" aria-label="Default signature">
            <dk-choice value="yes" [selected]="sigDefault" (pick)="sigDefault=true">Default</dk-choice>
            <dk-choice value="no" [selected]="!sigDefault" (pick)="sigDefault=false">Not default</dk-choice>
          </div>
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
          <input [(ngModel)]="setName" placeholder="Set name" [class]="field" />
          <input [(ngModel)]="setTemplate" placeholder="Optional template body" [class]="field" />
        </div>
        <p class="mb-2 text-[11px] text-[#63676c] dark:text-zinc-400">Channels in this set</p>
        <div class="mb-3 flex flex-wrap gap-1.5">
          @for (a of accounts(); track a.id) {
            <dk-pill [on]="setChannels().includes(a.id)" (toggle)="toggleSetChannel(a.id)">{{ a.network }} · {{ a.handle }}</dk-pill>
          }
        </div>
        <button type="button" (click)="addSet()" class="h-10 rounded-full bg-cta px-4 text-xs font-semibold text-white hover:bg-cta-hover">Create set</button>
        @for (s of sets(); track s.id) {
          <p class="mt-2 rounded-lg border border-[#e8e8e3] px-3 py-2 text-[13px] dark:border-zinc-700 dark:text-zinc-200">{{ s.name }} · {{ channelCount(s.channelIds) }} channels</p>
        }
      </section>

      <section class="mb-4 rounded-xl border border-[#e8e8e3] bg-white p-4 shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
        <p class="mb-3 font-mono text-[10px] uppercase tracking-wider text-[#92969b] dark:text-zinc-500">Customer groups</p>
        <div class="mb-3 flex gap-2">
          <input [(ngModel)]="groupName" placeholder="Client / brand" [class]="field + ' flex-1'" />
          <button type="button" (click)="addGroup()" class="h-10 rounded-full bg-cta px-4 text-xs font-semibold text-white hover:bg-cta-hover">Add</button>
        </div>
        @for (g of groups(); track g.id) {
          <div class="mb-3 rounded-lg border border-[#e8e8e3] p-3 dark:border-zinc-700">
            <p class="text-[13px] font-semibold dark:text-zinc-100">{{ g.name }}</p>
            <p class="mb-2 text-[11px] text-[#63676c] dark:text-zinc-400">Assign channels to this group</p>
            <div class="mb-2 flex flex-wrap gap-1.5">
              @for (a of accounts(); track a.id) {
                <dk-pill [on]="(groupDraft()[g.id] || []).includes(a.id)" (toggle)="toggleGroupAccount(g.id, a.id)">{{ a.network }} · {{ a.handle }}</dk-pill>
              }
            </div>
            <button type="button" (click)="saveGroupAccounts(g.id)" class="h-8 rounded-full border border-[#e8e8e3] px-3 text-[11px] font-semibold hover:bg-[#f7f7f4] dark:border-zinc-600 dark:hover:bg-zinc-800">Save assignments</button>
          </div>
        }
      </section>

      <section class="mb-4 rounded-xl border border-[#e8e8e3] bg-white p-4 shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
        <p class="mb-3 font-mono text-[10px] uppercase tracking-wider text-[#92969b] dark:text-zinc-500">RSS auto-post</p>
        <div class="mb-3 grid gap-2 sm:grid-cols-2">
          <input [(ngModel)]="rssUrl" placeholder="https://blog.example.com/feed" [class]="field + ' min-w-[16rem] sm:col-span-2'" />
          <label class="text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Channel
            <div class="mt-1">
              <dk-select [(ngModel)]="rssChannelId">
                <option value="">None</option>
                @for (a of accounts(); track a.id) {
                  <option [value]="a.id">{{ a.network }} · {{ a.handle }}</option>
                }
              </dk-select>
            </div>
          </label>
          <label class="text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Customer group
            <div class="mt-1">
              <dk-select [(ngModel)]="rssGroupId">
                <option value="">None</option>
                @for (g of groups(); track g.id) {
                  <option [value]="g.id">{{ g.name }}</option>
                }
              </dk-select>
            </div>
          </label>
        </div>
        <button type="button" (click)="addRss()" class="h-10 rounded-full bg-cta px-4 text-xs font-semibold text-white hover:bg-cta-hover">Watch feed</button>
        @for (f of feeds(); track f.id) {
          <p class="mt-2 truncate rounded-lg border border-[#e8e8e3] px-3 py-2 text-[13px] dark:border-zinc-700 dark:text-zinc-200">{{ f.url }}</p>
        }
      </section>

      <section class="mb-4 rounded-xl border border-[#e8e8e3] bg-white p-4 shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
        <p class="mb-3 font-mono text-[10px] uppercase tracking-wider text-[#92969b] dark:text-zinc-500">Plugs</p>
        <div class="mb-3 grid gap-2 sm:grid-cols-2">
          <input [(ngModel)]="plugName" placeholder="Plug name" [class]="field" />
          <input [(ngModel)]="plugBody" placeholder="Post body when triggered" [class]="field" />
          <div class="sm:col-span-2">
            <p class="mb-2 text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Trigger</p>
            <div class="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Plug trigger">
              <dk-choice value="manual" [selected]="plugTrigger==='manual'" (pick)="plugTrigger=$any($event)">Manual</dk-choice>
              <dk-choice value="on_publish" [selected]="plugTrigger==='on_publish'" (pick)="plugTrigger=$any($event)">On publish</dk-choice>
              <dk-choice value="schedule" [selected]="plugTrigger==='schedule'" (pick)="plugTrigger=$any($event)">Schedule</dk-choice>
            </div>
          </div>
          @if (plugTrigger === 'schedule') {
            <label class="text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Every (minutes)
              <input type="number" [(ngModel)]="plugEvery" min="15" [class]="'mt-1 ' + field" />
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
          <input [(ngModel)]="hookName" placeholder="Name" [class]="field" />
          <input [(ngModel)]="hookUrl" placeholder="https://example.com/hook" [class]="field + ' min-w-[14rem] flex-1'" />
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
  readonly field = FIELD;
  workspaceId = "";
  channelId = "";
  rssChannelId = "";
  rssGroupId = "";
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
  groups = signal<{ id: string; name: string; accountIds: string[] }[]>([]);
  groupDraft = signal<Record<string, string[]>>({});
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
      this.rssChannelId = ac.accounts[0]?.id || "";
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
      api<{ groups: { id: string; name: string; accountIds: string[] }[] }>(`/v1/org/groups?workspaceId=${w}`),
      api<{ feeds: { id: string; url: string }[] }>(`/v1/org/rss?workspaceId=${w}`),
      api<{ plugs: { id: string; name: string; scope: string; triggerType: string }[] }>(`/v1/org/plugs?workspaceId=${w}`),
      api<{ tokens: { id: string; name: string; tokenPrefix: string }[] }>(`/v1/org/tokens?workspaceId=${w}`),
      api<{ integrations: { id: string; name: string; url: string }[] }>(`/v1/org/integrations?workspaceId=${w}`),
    ]);
    this.signatures.set(sigs.signatures);
    this.sets.set(sets.sets);
    this.groups.set(groups.groups);
    const draft: Record<string, string[]> = {};
    for (const g of groups.groups) draft[g.id] = [...(g.accountIds || [])];
    this.groupDraft.set(draft);
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

  toggleGroupAccount(groupId: string, accountId: string) {
    const draft = { ...this.groupDraft() };
    const cur = new Set(draft[groupId] || []);
    if (cur.has(accountId)) cur.delete(accountId);
    else cur.add(accountId);
    draft[groupId] = [...cur];
    this.groupDraft.set(draft);
  }

  async saveGroupAccounts(groupId: string) {
    await api(`/v1/org/groups/${groupId}/accounts`, {
      method: "PUT",
      json: { workspaceId: this.workspaceId, accountIds: this.groupDraft()[groupId] || [] },
    });
    await this.reload();
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
    if (!this.rssChannelId && !this.rssGroupId) return;
    await api("/v1/org/rss", {
      method: "POST",
      json: {
        workspaceId: this.workspaceId,
        url: this.rssUrl,
        channelIds: this.rssChannelId ? [this.rssChannelId] : [],
        groupId: this.rssGroupId || null,
      },
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
