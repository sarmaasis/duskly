import { Component, signal, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { api } from "../lib/api";
import { setDarkClass } from "../lib/browser";
import { DkChoice, DkPill, DkSelect } from "../ui/forms";

@Component({
  standalone: true,
  imports: [FormsModule, DkSelect, DkChoice, DkPill],
  template: `
    <div class="mx-auto w-full max-w-7xl space-y-10">
      <div class="border-b border-[#e8e8e3] pb-8 dark:border-zinc-800">
        <div class="mb-1.5 flex items-center gap-2">
          <span class="text-xs font-semibold uppercase tracking-wider text-cta">Account</span>
          <span class="text-zinc-300 dark:text-zinc-600">/</span>
          <span class="font-mono text-xs font-medium text-zinc-500">Preferences &amp; Automation</span>
        </div>
        <h1 class="font-display text-3xl font-bold tracking-tight text-[#121417] md:text-4xl dark:text-zinc-50">Settings</h1>
        <p class="mt-1.5 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">Manage your global signatures, auto-posting rules, connected feeds, API tokens, and webhooks in one unified space.</p>
      </div>

      <div class="grid grid-cols-1 gap-8 xl:grid-cols-3">
        <section class="relative overflow-hidden rounded-2xl border border-[#e8e8e3] bg-white p-6 shadow-sm xl:col-span-2 dark:border-zinc-700 dark:bg-zinc-900">
          <div>
            <h2 class="font-display text-xl font-bold text-[#121417] dark:text-zinc-50">Workspace Configuration</h2>
            <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Signatures, feeds, and keys for this workspace. Changes apply to compose and RSS.</p>
          </div>
          <div class="mt-6 flex items-center justify-between gap-3 rounded-xl border border-[#e8e8e3] bg-[#f7f7f4] px-3.5 py-3 dark:border-zinc-700 dark:bg-zinc-800">
            <div class="min-w-0">
              <p class="text-[11px] font-semibold uppercase text-zinc-400">Workspace ID</p>
              @if (workspaceId) {
                <p class="mt-0.5 truncate font-mono text-sm text-[#121417] dark:text-zinc-100">{{ workspaceId }}</p>
              } @else if (sessionReady()) {
                <p class="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Sign in to see the id used in API requests.</p>
              } @else {
                <p class="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Loading…</p>
              }
            </div>
            @if (workspaceId) {
              <button type="button" (click)="copyWorkspaceId()" class="shrink-0 rounded-xl border border-[#e8e8e3] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#121417] hover:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800">{{ idCopied() ? 'Copied' : 'Copy' }}</button>
            }
          </div>
          <div class="mt-8 flex flex-wrap items-center gap-6 border-t border-[#e8e8e3] pt-6 dark:border-zinc-700">
            <div>
              <p class="text-[11px] font-semibold uppercase text-zinc-400">Signatures</p>
              <p class="font-display text-lg font-bold text-[#121417] dark:text-zinc-50">{{ signatures().length }}</p>
            </div>
            <div class="h-8 w-px bg-[#e8e8e3] dark:bg-zinc-700"></div>
            <div>
              <p class="text-[11px] font-semibold uppercase text-zinc-400">RSS Feeds</p>
              <p class="font-display text-lg font-bold text-[#121417] dark:text-zinc-50">{{ feeds().length }}</p>
            </div>
            <div class="h-8 w-px bg-[#e8e8e3] dark:bg-zinc-700"></div>
            <div>
              <p class="text-[11px] font-semibold uppercase text-zinc-400">API Tokens</p>
              <p class="font-display text-lg font-bold text-[#121417] dark:text-zinc-50">{{ tokens().length }}</p>
            </div>
          </div>
        </section>
        <section class="flex flex-col justify-between rounded-2xl bg-[#121417] p-6 text-white shadow-sm dark:bg-zinc-800">
          <div class="space-y-3">
            <p class="text-xs font-medium uppercase tracking-wider text-zinc-400">Appearance</p>
            <h2 class="font-display text-2xl font-bold">Theme</h2>
            <p class="text-xs leading-relaxed text-zinc-400">Light or dark for this workspace. Same control as the sidebar.</p>
          </div>
          <div class="mt-6 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Theme">
            <dk-choice value="light" [selected]="theme()==='light'" (pick)="setTheme($event)">Light</dk-choice>
            <dk-choice value="dark" [selected]="theme()==='dark'" (pick)="setTheme($event)">Dark</dk-choice>
          </div>
        </section>
      </div>

      <div class="grid grid-cols-1 gap-8 lg:grid-cols-2">

        <section class="flex flex-col space-y-6 rounded-2xl border border-[#e8e8e3] bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2.5">
              <div class="flex size-8 items-center justify-center rounded-lg bg-orange-50 text-cta dark:bg-orange-950/40">
                <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M4 20h16M7 16c2-6 8-6 10 0M9 8a3 3 0 1 0 6 0 3 3 0 0 0-6 0" stroke-linecap="round"/></svg>
              </div>
              <div>
                <h2 class="font-display text-base font-bold text-[#121417] dark:text-zinc-50">Signatures</h2>
                <p class="text-xs text-zinc-500 dark:text-zinc-400">Append custom footers or promotional tags automatically.</p>
              </div>
            </div>
          </div>
          <div class="space-y-3">
            <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-400">Name
              <input [(ngModel)]="sigName" placeholder="Name" [class]="fieldMt" />
            </label>
            <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-400">Signature Content
              <input [(ngModel)]="sigBody" placeholder="via Duskly" [class]="fieldMt" />
            </label>
            <div>
              <p class="mb-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-400">Default</p>
              <div class="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Default signature">
                <dk-choice value="yes" [selected]="sigDefault" (pick)="sigDefault=true">Default</dk-choice>
                <dk-choice value="no" [selected]="!sigDefault" (pick)="sigDefault=false">Not default</dk-choice>
              </div>
            </div>
            <button type="button" (click)="addSig()" class="flex w-full items-center justify-center rounded-xl border border-[#e8e8e3] bg-[#f7f7f4] py-2.5 text-xs font-semibold text-[#121417] transition-all hover:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100">Add Signature</button>
          </div>
          <div class="space-y-2 pt-2">
            <p class="text-[11px] font-semibold uppercase text-zinc-400">Existing Signatures</p>
            @for (s of signatures(); track s.id) {
              <div class="flex items-center justify-between gap-3 rounded-xl border border-[#e8e8e3] bg-[#f7f7f4] p-3 text-xs dark:border-zinc-700 dark:bg-zinc-800">
                <div class="flex min-w-0 items-center gap-2">
                  <span class="size-2 shrink-0 rounded-full" [class.bg-cta]="s.isDefault" [class.bg-zinc-300]="!s.isDefault"></span>
                  <span class="truncate font-medium text-[#121417] dark:text-zinc-100">{{ s.name }}: {{ s.body }}{{ s.isDefault ? ' · default' : '' }}</span>
                </div>
                @if (!s.isDefault) {
                  <button type="button" (click)="setDefaultSig(s.id)" class="shrink-0 text-xs font-semibold text-cta">Set default</button>
                }
              </div>
            } @empty {
              <p class="text-xs text-zinc-500 dark:text-zinc-400">No signatures yet.</p>
            }
          </div>
        </section>

        <section class="flex flex-col space-y-6 rounded-2xl border border-[#e8e8e3] bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div class="flex items-center gap-2.5">
            <div class="flex size-8 items-center justify-center rounded-lg bg-orange-50 text-cta dark:bg-orange-950/40">
              <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke-linecap="round"/></svg>
            </div>
            <div>
              <h2 class="font-display text-base font-bold text-[#121417] dark:text-zinc-50">Posting Sets</h2>
              <p class="text-xs text-zinc-500 dark:text-zinc-400">Preset sets of templates for rapid campaign creation.</p>
            </div>
          </div>
          <div class="space-y-3">
            <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-400">Set Name
              <input [(ngModel)]="setName" placeholder="Set name" [class]="fieldMt" />
            </label>
            <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-400">Template Body
              <input [(ngModel)]="setTemplate" placeholder="Optional template body" [class]="fieldMt" />
            </label>
            <div>
              <p class="mb-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-400">Channels in this set</p>
              <div class="flex flex-wrap gap-1.5">
                @for (a of accounts(); track a.id) {
                  <dk-pill [on]="setChannels().includes(a.id)" (toggle)="toggleSetChannel(a.id)">{{ a.network }} · {{ a.handle }}</dk-pill>
                }
              </div>
            </div>
            <button type="button" (click)="addSet()" class="flex w-full items-center justify-center rounded-xl bg-[#121417] py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-black dark:bg-zinc-100 dark:text-zinc-900">Create Posting Set</button>
          </div>
          <div class="space-y-2">
            @for (s of sets(); track s.id) {
              <p class="rounded-xl border border-[#e8e8e3] bg-[#f7f7f4] p-3 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{{ s.name }} · {{ channelCount(s.channelIds) }} channels</p>
            } @empty {
              <p class="rounded-xl border border-[#e8e8e3] bg-[#f7f7f4] p-3 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">No posting sets yet.</p>
            }
          </div>
        </section>

        <section class="flex flex-col space-y-6 rounded-2xl border border-[#e8e8e3] bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div class="flex items-center gap-2.5">
            <div class="flex size-8 items-center justify-center rounded-lg bg-orange-50 text-cta dark:bg-orange-950/40">
              <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><circle cx="9" cy="7" r="3"/><path d="M3 19v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1M16 3.1a3 3 0 0 1 0 5.8M21 19v-1a4 4 0 0 0-3-3.9" stroke-linecap="round"/></svg>
            </div>
            <div>
              <h2 class="font-display text-base font-bold text-[#121417] dark:text-zinc-50">Customer Groups</h2>
              <p class="text-xs text-zinc-500 dark:text-zinc-400">Segment clients or brand identities for tailored publishing.</p>
            </div>
          </div>
          <div class="space-y-3">
            <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-400">Client / Brand Name
              <input [(ngModel)]="groupName" placeholder="Client / brand" [class]="fieldMt" />
            </label>
            <button type="button" (click)="addGroup()" class="flex w-full items-center justify-center rounded-xl border border-[#e8e8e3] bg-[#f7f7f4] py-2.5 text-xs font-semibold text-[#121417] transition-all hover:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100">Add Customer Group</button>
          </div>
          <div class="space-y-3">
            @for (g of groups(); track g.id) {
              <div class="rounded-xl border border-[#e8e8e3] bg-[#f7f7f4] p-3 dark:border-zinc-700 dark:bg-zinc-800">
                <p class="text-xs font-semibold text-[#121417] dark:text-zinc-100">{{ g.name }}</p>
                <p class="mb-2 mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">Assign channels to this group</p>
                <div class="mb-2 flex flex-wrap gap-1.5">
                  @for (a of accounts(); track a.id) {
                    <dk-pill [on]="(groupDraft()[g.id] || []).includes(a.id)" (toggle)="toggleGroupAccount(g.id, a.id)">{{ a.network }} · {{ a.handle }}</dk-pill>
                  }
                </div>
                <button type="button" (click)="saveGroupAccounts(g.id)" class="rounded-xl border border-[#e8e8e3] bg-white px-3 py-1.5 text-[11px] font-semibold hover:bg-white dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800">Save assignments</button>
              </div>
            }
          </div>
        </section>

        <section class="flex flex-col space-y-6 rounded-2xl border border-[#e8e8e3] bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div class="flex items-center gap-2.5">
            <div class="flex size-8 items-center justify-center rounded-lg bg-orange-50 text-cta dark:bg-orange-950/40">
              <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><circle cx="6" cy="18" r="2"/><circle cx="6" cy="6" r="2"/><path d="M8 6c6 0 10 4 10 10M8 18c4 0 6-2 6-6" stroke-linecap="round"/></svg>
            </div>
            <div>
              <h2 class="font-display text-base font-bold text-[#121417] dark:text-zinc-50">RSS Auto-Post</h2>
              <p class="text-xs text-zinc-500 dark:text-zinc-400">Automatically syndicate RSS updates to specific channels.</p>
            </div>
          </div>
          <div class="space-y-3">
            <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-400">Feed URL
              <input [(ngModel)]="rssUrl" placeholder="https://blog.example.com/feed" [class]="fieldMt" />
            </label>
            <div class="grid grid-cols-2 gap-3">
              <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-400">Channel
                <div class="mt-1.5">
                  <dk-select [(ngModel)]="rssChannelId">
                    <option value="">None</option>
                    @for (a of accounts(); track a.id) {
                      <option [value]="a.id">{{ a.network }} · {{ a.handle }}</option>
                    }
                  </dk-select>
                </div>
              </label>
              <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-400">Customer Group
                <div class="mt-1.5">
                  <dk-select [(ngModel)]="rssGroupId">
                    <option value="">None</option>
                    @for (g of groups(); track g.id) {
                      <option [value]="g.id">{{ g.name }}</option>
                    }
                  </dk-select>
                </div>
              </label>
            </div>
            <button type="button" (click)="addRss()" class="flex w-full items-center justify-center rounded-xl bg-cta py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-cta-hover">Watch Feed</button>
          </div>
          <div class="space-y-2">
            @for (f of feeds(); track f.id) {
              <p class="truncate rounded-xl border border-[#e8e8e3] bg-[#f7f7f4] p-3 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">{{ f.url }}</p>
            }
          </div>
        </section>

        <section class="flex flex-col space-y-6 rounded-2xl border border-[#e8e8e3] bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div class="flex items-center gap-2.5">
            <div class="flex size-8 items-center justify-center rounded-lg bg-orange-50 text-cta dark:bg-orange-950/40">
              <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2"/><path d="M7 11H4M20 11h-3M11 7V4M11 20v-3" stroke-linecap="round"/></svg>
            </div>
            <div>
              <h2 class="font-display text-base font-bold text-[#121417] dark:text-zinc-50">Plugs</h2>
              <p class="text-xs text-zinc-500 dark:text-zinc-400">Trigger extensions or custom scripts during publishing flows.</p>
            </div>
          </div>
          <div class="space-y-3">
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-400">Plug Name
                <input [(ngModel)]="plugName" placeholder="Plug name" [class]="fieldMt" />
              </label>
              <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-400">Plug Body / Payload
                <input [(ngModel)]="plugBody" placeholder="Post body when triggered" [class]="fieldMt" />
              </label>
            </div>
            <div>
              <p class="mb-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-400">Trigger</p>
              <div class="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Plug trigger">
                <dk-choice value="manual" [selected]="plugTrigger==='manual'" (pick)="plugTrigger=$any($event)">Manual</dk-choice>
                <dk-choice value="on_publish" [selected]="plugTrigger==='on_publish'" (pick)="plugTrigger=$any($event)">On publish</dk-choice>
                <dk-choice value="schedule" [selected]="plugTrigger==='schedule'" (pick)="plugTrigger=$any($event)">Schedule</dk-choice>
              </div>
            </div>
            @if (plugTrigger === 'schedule') {
              <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-400">Every (minutes)
                <input type="number" [(ngModel)]="plugEvery" min="15" [class]="fieldMt" />
              </label>
            }
            <div class="grid grid-cols-2 gap-2">
              <button type="button" (click)="addPlug('internal')" class="rounded-xl border border-[#e8e8e3] bg-[#f7f7f4] py-2.5 text-xs font-semibold text-[#121417] hover:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100">Add internal</button>
              <button type="button" (click)="addPlug('global')" class="rounded-xl border border-[#e8e8e3] bg-[#f7f7f4] py-2.5 text-xs font-semibold text-[#121417] hover:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100">Add global</button>
            </div>
          </div>
          <div class="space-y-2">
            @for (p of plugs(); track p.id) {
              <div class="flex items-center justify-between gap-3 rounded-xl border border-[#e8e8e3] bg-[#f7f7f4] p-3 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                <span>{{ p.scope }} · {{ p.triggerType }} · {{ p.name }}</span>
                <button type="button" (click)="runPlug(p.id)" class="font-semibold text-cta">Run</button>
              </div>
            }
          </div>
        </section>

        <section class="flex flex-col space-y-6 rounded-2xl border border-[#e8e8e3] bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2.5">
              <div class="flex size-8 items-center justify-center rounded-lg bg-orange-50 text-cta dark:bg-orange-950/40">
                <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><circle cx="8" cy="15" r="3"/><path d="M11 15h10M17 15v-4a2 2 0 0 1 2-2" stroke-linecap="round"/></svg>
              </div>
              <div>
                <h2 class="font-display text-base font-bold text-[#121417] dark:text-zinc-50">API Tokens</h2>
                <p class="text-xs text-zinc-500 dark:text-zinc-400">Manage developer access keys for CI/CD and CLI integrations.</p>
              </div>
            </div>
            <button type="button" (click)="createToken()" class="shrink-0 rounded-xl bg-[#121417] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-black dark:bg-zinc-100 dark:text-zinc-900">Create Token</button>
          </div>
          @if (newToken()) {
            <p class="break-all rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">Copy now: {{ newToken() }}</p>
          }
          <div class="space-y-2">
            @for (t of tokens(); track t.id) {
              <div class="rounded-xl border border-[#e8e8e3] bg-[#f7f7f4] p-3 text-xs dark:border-zinc-700 dark:bg-zinc-800">
                <p class="font-semibold text-[#121417] dark:text-zinc-100">{{ t.name }}</p>
                <p class="font-mono text-[11px] text-zinc-400">{{ t.tokenPrefix }}…</p>
              </div>
            } @empty {
              <p class="text-xs text-zinc-500 dark:text-zinc-400">No tokens yet.</p>
            }
          </div>
        </section>

        <section class="flex flex-col space-y-6 rounded-2xl border border-[#e8e8e3] bg-white p-6 shadow-sm lg:col-span-2 dark:border-zinc-700 dark:bg-zinc-900">
          <div class="flex items-center gap-2.5">
            <div class="flex size-8 items-center justify-center rounded-lg bg-orange-50 text-cta dark:bg-orange-950/40">
              <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" stroke-linecap="round"/></svg>
            </div>
            <div>
              <h2 class="font-display text-base font-bold text-[#121417] dark:text-zinc-50">Integrations &amp; Webhooks</h2>
              <p class="text-xs text-zinc-500 dark:text-zinc-400">Real-time event streaming to your internal endpoints and analytics systems.</p>
            </div>
          </div>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-400">Webhook Name
              <input [(ngModel)]="hookName" placeholder="Name" [class]="fieldMt" />
            </label>
            <label class="block text-xs font-medium text-zinc-700 md:col-span-2 dark:text-zinc-400">Webhook Endpoint URL
              <div class="mt-1.5 flex flex-col gap-2 sm:flex-row">
                <input [(ngModel)]="hookUrl" placeholder="https://example.com/hook" [class]="field + ' flex-1'" />
                <button type="button" (click)="addHook()" class="shrink-0 rounded-xl bg-cta px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-cta-hover">Add Webhook</button>
              </div>
            </label>
          </div>
          <div class="space-y-2">
            @for (h of hooks(); track h.id) {
              <div class="flex flex-col justify-between gap-2 rounded-xl border border-[#e8e8e3] bg-[#f7f7f4] p-3.5 text-xs sm:flex-row sm:items-center dark:border-zinc-700 dark:bg-zinc-800">
                <div>
                  <p class="font-semibold text-[#121417] dark:text-zinc-100">{{ h.name }}</p>
                  <p class="truncate font-mono text-[11px] text-zinc-400">{{ h.url }}</p>
                </div>
              </div>
            }
          </div>
        </section>
      </div>
    </div>
  `,
})
export class SettingsPage implements OnInit {
  readonly field =
    "h-11 w-full rounded-xl border border-[#e8e8e3] bg-[#fbfbfa] px-3.5 text-sm text-[#121417] outline-none transition-colors focus:border-cta disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100";
  readonly fieldMt = `mt-1.5 ${this.field}`;
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
  theme = signal<"light" | "dark">("light");
  sessionReady = signal(false);
  idCopied = signal(false);
  private copyTimer: ReturnType<typeof setTimeout> | null = null;

  async ngOnInit() {
    try {
      const me = await api<{ workspace: { id: string; theme?: string } }>("/v1/workspaces/me");
      this.workspaceId = me.workspace.id;
      const t = me.workspace.theme === "dark" ? "dark" : "light";
      this.theme.set(t);
      setDarkClass(t === "dark");
      const ac = await api<{ accounts: { id: string; network: string; handle: string }[] }>(
        `/v1/accounts?workspaceId=${this.workspaceId}`,
      );
      this.accounts.set(ac.accounts);
      this.channelId = ac.accounts[0]?.id || "";
      this.rssChannelId = ac.accounts[0]?.id || "";
      await this.reload();
    } catch {
      /* unauthenticated — Workspace ID row explains sign-in */
    } finally {
      this.sessionReady.set(true);
    }
  }

  async copyWorkspaceId() {
    if (!this.workspaceId) return;
    try {
      await navigator.clipboard.writeText(this.workspaceId);
      this.idCopied.set(true);
      if (this.copyTimer) clearTimeout(this.copyTimer);
      this.copyTimer = setTimeout(() => this.idCopied.set(false), 1500);
    } catch {
      /* clipboard unavailable */
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

  async setTheme(value: string) {
    const next = value === "dark" ? "dark" : "light";
    this.theme.set(next);
    setDarkClass(next === "dark");
    if (!this.workspaceId) return;
    try {
      await api(`/v1/workspaces/${this.workspaceId}`, { method: "PATCH", json: { theme: next } });
    } catch {
      /* local only */
    }
  }
}
