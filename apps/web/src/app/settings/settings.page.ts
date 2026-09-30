import { Component, signal, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { api, apiAll } from "../lib/api";
import { setDarkClass } from "../lib/browser";
import { labelNetwork, labelStatus } from "../lib/labels";
import { DkChoice, DkPill, DkSelect } from "../ui/forms";
import { Spinner } from "../ui/spinner";

@Component({
  standalone: true,
  imports: [FormsModule, DkSelect, DkChoice, DkPill, Spinner],
  template: `
    <div class="mx-auto grid w-full max-w-5xl items-start gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <div>
        <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-cta">Account</p>
        <h1 class="mt-1 font-display text-3xl font-bold tracking-tight text-ink dark:text-zinc-50">Settings</h1>
        <nav class="mt-4 flex gap-1 overflow-x-auto lg:flex-col" aria-label="Settings">
          @for (item of sections; track item.id) {
            <button
              type="button"
              (click)="section.set(item.id)"
              class="shrink-0 rounded-lg px-2.5 py-1.5 text-left text-[13px]"
              [class]="section() === item.id ? 'bg-cta-soft font-semibold text-cta dark:bg-[#3a221c] dark:text-cta' : 'text-muted hover:bg-cta-soft dark:text-zinc-400 dark:hover:bg-[#3a221c]'"
            >{{ item.label }}</button>
          }
        </nav>
      </div>
      <div>
        @if (!sessionReady()) {
          <div class="flex justify-center text-cta"><dk-spinner [size]="20" label="Loading" [block]="true" /></div>
        } @else { @switch (section()) {
          @case ('workspace') {
        <section class="rounded-2xl border border-[#e8e8e3] bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <h2 class="font-display text-base font-bold text-[#121417] dark:text-zinc-50">Workspace</h2>
          <div class="mt-3 flex items-center justify-between gap-3 rounded-lg border border-[#e8e8e3] bg-[#f7f7f4] px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
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
              <button type="button" (click)="copyWorkspaceId()" [class]="btn">{{ idCopied() ? 'Copied' : 'Copy' }}</button>
            }
          </div>
          <form class="mt-4 grid gap-3 sm:grid-cols-2" (ngSubmit)="saveStudio()">
            <label class="text-xs font-medium text-zinc-600 dark:text-zinc-400">Custom domain
              <input [(ngModel)]="customDomain" name="customDomain" placeholder="clients.example.com" [class]="fieldMt" />
            </label>
            <label class="text-xs font-medium text-zinc-600 dark:text-zinc-400">Failure email
              <input [(ngModel)]="alertEmail" name="alertEmail" type="email" placeholder="you@studio.com" [class]="fieldMt" />
            </label>
            <label class="text-xs font-medium text-zinc-600 dark:text-zinc-400">Hashtag group
              <input [(ngModel)]="hashName" name="hashName" placeholder="Launch" [class]="fieldMt" />
            </label>
            <label class="text-xs font-medium text-zinc-600 dark:text-zinc-400">Tags
              <input [(ngModel)]="hashTags" name="hashTags" placeholder="#launch #duskly" [class]="fieldMt" />
            </label>
            <div class="sm:col-span-2">
              <button type="submit" [class]="btn" [disabled]="!!busy()" [attr.aria-busy]="busy() === 'studio'">@if (busy() === 'studio') { <dk-spinner /> } Save studio</button>
            </div>
          </form>
        </section>
          }
          @case ('signatures') {
        <section class="flex flex-col space-y-6 rounded-2xl border border-[#e8e8e3] bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2.5">
              <div class="flex size-8 items-center justify-center rounded-lg bg-cta-soft text-cta dark:bg-[#3a221c]">
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
            <button type="button" (click)="addSig()" [class]="btn" [disabled]="!!busy()" [attr.aria-busy]="busy() === 'sig'">@if (busy() === 'sig') { <dk-spinner /> } Add Signature</button>
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
          }
          @case ('sets') {
        <section class="flex flex-col space-y-6 rounded-2xl border border-[#e8e8e3] bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <div class="flex items-center gap-2.5">
            <div class="flex size-8 items-center justify-center rounded-lg bg-cta-soft text-cta dark:bg-[#3a221c]">
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
                  <dk-pill [on]="setChannels().includes(a.id)" (toggle)="toggleSetChannel(a.id)">{{ labelNetwork(a.network) }} · {{ a.handle }}</dk-pill>
                }
              </div>
            </div>
            <button type="button" (click)="addSet()" [class]="btn" [disabled]="!!busy()" [attr.aria-busy]="busy() === 'set'">@if (busy() === 'set') { <dk-spinner /> } Create Posting Set</button>
          </div>
          <div class="space-y-2">
            @for (s of sets(); track s.id) {
              <p class="rounded-xl border border-[#e8e8e3] bg-[#f7f7f4] p-3 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{{ s.name }} · {{ channelCount(s.channelIds) }} channels</p>
            } @empty {
              <p class="rounded-xl border border-[#e8e8e3] bg-[#f7f7f4] p-3 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">No posting sets yet.</p>
            }
          </div>
        </section>
          }
          @case ('groups') {
        <section class="flex flex-col space-y-6 rounded-2xl border border-[#e8e8e3] bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <div class="flex items-center gap-2.5">
            <div class="flex size-8 items-center justify-center rounded-lg bg-cta-soft text-cta dark:bg-[#3a221c]">
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
            <button type="button" (click)="addGroup()" [class]="btn" [disabled]="!!busy()" [attr.aria-busy]="busy() === 'group'">@if (busy() === 'group') { <dk-spinner /> } Add Customer Group</button>
          </div>
          @if (groups().length > 3) {
            <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-400">Find a brand
              <input [ngModel]="brandQuery()" (ngModelChange)="brandQuery.set($event)" name="brandQuery" placeholder="Search brands" class="mt-1 h-10 w-full rounded-lg border border-[#e8e8e3] bg-white px-3 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100" />
            </label>
            <div class="space-y-1">
              @for (g of visibleBrands(); track g.id) {
                <button type="button" (click)="pickBrand(g.id)" class="flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-sm" [class]="brandOpen(g.id) ? 'bg-white font-semibold text-[#121417] dark:bg-zinc-900 dark:text-zinc-50' : 'text-[#121417] hover:bg-white/70 dark:text-zinc-200 dark:hover:bg-zinc-900/60'">
                  <span class="truncate">{{ g.name }}</span>
                  <span class="shrink-0 text-xs font-medium text-zinc-500">{{ accountCount(g.id) }}</span>
                </button>
              } @empty {
                <p class="px-1 text-xs text-zinc-500">No brands match.</p>
              }
            </div>
          }
          <div class="space-y-3">
            @for (g of editedBrands(); track g.id) {
              <div class="rounded-xl border border-[#e8e8e3] bg-[#f7f7f4] p-3 dark:border-zinc-700 dark:bg-zinc-800">
                <p class="text-sm font-semibold text-[#121417] dark:text-zinc-100">{{ g.name }}</p>
                <p class="mb-2 mt-1 text-xs text-zinc-500 dark:text-zinc-400">{{ (groupDraft()[g.id] || []).length }} account{{ (groupDraft()[g.id] || []).length === 1 ? '' : 's' }} in this brand</p>
                @if (!accounts().length) {
                  <p class="text-sm text-zinc-600 dark:text-zinc-300">Connect an account before you can add it to this brand.</p>
                  <a href="/app/accounts" class="mt-2 inline-flex text-sm font-semibold text-cta">Go to Accounts</a>
                } @else if (accounts().length > 8) {
                  <div class="mb-2 flex flex-wrap gap-1.5">
                    @for (a of assignedTo(g.id); track a.id) {
                      <button type="button" (click)="toggleGroupAccount(g.id, a.id)" class="inline-flex min-h-8 items-center gap-1 rounded-full bg-white px-3 text-xs font-semibold text-[#121417] dark:bg-zinc-900 dark:text-zinc-100">
                        {{ labelNetwork(a.network) }} · {{ a.handle }} <span aria-hidden="true">×</span>
                      </button>
                    } @empty {
                      <p class="text-xs text-zinc-500">No accounts yet. Search below to add one.</p>
                    }
                  </div>
                  <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-300">Add an account
                    <input [ngModel]="groupQuery()[g.id] || ''" (ngModelChange)="setGroupQuery(g.id, $event)" [name]="'find-' + g.id" placeholder="Search by name" class="mt-1 h-10 w-full rounded-lg border border-[#e8e8e3] bg-white px-3 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100" />
                  </label>
                  <div class="mt-2 space-y-1">
                    @for (a of accountMatches(g.id); track a.id) {
                      <button type="button" (click)="toggleGroupAccount(g.id, a.id)" class="flex min-h-10 w-full items-center rounded-lg bg-white px-3 text-left text-sm dark:bg-zinc-900">{{ labelNetwork(a.network) }} · {{ a.handle }}</button>
                    }
                  </div>
                } @else {
                  <div class="mb-2 flex flex-wrap gap-1.5">
                    @for (a of accounts(); track a.id) {
                      <dk-pill [on]="(groupDraft()[g.id] || []).includes(a.id)" (toggle)="toggleGroupAccount(g.id, a.id)">{{ labelNetwork(a.network) }} · {{ a.handle }}</dk-pill>
                    }
                  </div>
                }
                @if (accounts().length) {
                  <div class="mt-2 flex flex-wrap items-center gap-3">
                    <button type="button" (click)="saveGroupAccounts(g.id)" [disabled]="savingGroup() === g.id" [attr.aria-busy]="savingGroup() === g.id" [class]="btn">@if (savingGroup() === g.id) { <dk-spinner /> } Save assignments</button>
                    @if (groupNote()[g.id]) {
                      <p class="text-sm font-medium" [class.text-red-600]="groupErr()[g.id]" [class.text-[#365314]]="!groupErr()[g.id]">{{ groupNote()[g.id] }}</p>
                    }
                  </div>
                }
              </div>
            }
          </div>
        </section>
          }
          @case ('rss') {
        <section class="flex flex-col space-y-6 rounded-2xl border border-[#e8e8e3] bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <div class="flex items-center gap-2.5">
            <div class="flex size-8 items-center justify-center rounded-lg bg-cta-soft text-cta dark:bg-[#3a221c]">
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
                      <option [value]="a.id">{{ labelNetwork(a.network) }} · {{ a.handle }}</option>
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
            <button type="button" (click)="addRss()" [class]="btn" [disabled]="!!busy()" [attr.aria-busy]="busy() === 'rss'">@if (busy() === 'rss') { <dk-spinner /> } Watch Feed</button>
          </div>
          <div class="space-y-2">
            @for (f of feeds(); track f.id) {
              <p class="truncate rounded-xl border border-[#e8e8e3] bg-[#f7f7f4] p-3 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">{{ f.url }}</p>
            }
          </div>
        </section>
          }
          @case ('plugs') {
        <section class="flex flex-col space-y-6 rounded-2xl border border-[#e8e8e3] bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <div class="flex items-center gap-2.5">
            <div class="flex size-8 items-center justify-center rounded-lg bg-cta-soft text-cta dark:bg-[#3a221c]">
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
            <div class="flex flex-wrap gap-2">
              <button type="button" (click)="addPlug('internal')" [class]="btn" [disabled]="!!busy()" [attr.aria-busy]="busy() === 'plug'">@if (busy() === 'plug') { <dk-spinner /> } Add internal</button>
              <button type="button" (click)="addPlug('global')" [class]="btn" [disabled]="!!busy()" [attr.aria-busy]="busy() === 'plug'">@if (busy() === 'plug') { <dk-spinner /> } Add global</button>
            </div>
          </div>
          <div class="space-y-2">
            @for (p of plugs(); track p.id) {
              <div class="flex items-center justify-between gap-3 rounded-xl border border-[#e8e8e3] bg-[#f7f7f4] p-3 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                <span>{{ labelStatus(p.scope) }} · {{ labelStatus(p.triggerType) }} · {{ p.name }}</span>
                <button type="button" (click)="runPlug(p.id)" class="font-semibold text-cta">Run</button>
              </div>
            }
          </div>
        </section>
          }
          @case ('tokens') {
        <section class="flex flex-col space-y-6 rounded-2xl border border-[#e8e8e3] bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2.5">
              <div class="flex size-8 items-center justify-center rounded-lg bg-cta-soft text-cta dark:bg-[#3a221c]">
                <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><circle cx="8" cy="15" r="3"/><path d="M11 15h10M17 15v-4a2 2 0 0 1 2-2" stroke-linecap="round"/></svg>
              </div>
              <div>
                <h2 class="font-display text-base font-bold text-[#121417] dark:text-zinc-50">API Tokens</h2>
                <p class="text-xs text-zinc-500 dark:text-zinc-400">Manage developer access keys for CI/CD and CLI integrations.</p>
              </div>
            </div>
            <button type="button" (click)="createToken()" [class]="btn" [disabled]="!!busy()" [attr.aria-busy]="busy() === 'token'">@if (busy() === 'token') { <dk-spinner /> } Create Token</button>
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
          }
          @case ('webhooks') {
        <section class="flex flex-col space-y-6 rounded-2xl border border-[#e8e8e3] bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <div class="flex items-center gap-2.5">
            <div class="flex size-8 items-center justify-center rounded-lg bg-cta-soft text-cta dark:bg-[#3a221c]">
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
                <button type="button" (click)="addHook()" [class]="btn" [disabled]="!!busy()" [attr.aria-busy]="busy() === 'hook'">@if (busy() === 'hook') { <dk-spinner /> } Add Webhook</button>
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
          }
        } }
      </div>
    </div>
  `,
})
export class SettingsPage implements OnInit {
  readonly labelStatus = labelStatus;
  readonly labelNetwork = labelNetwork;
  readonly field =
    "h-11 w-full rounded-xl border border-[#e8e8e3] bg-[#fbfbfa] px-3.5 text-sm text-[#121417] outline-none transition-colors focus:border-cta disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100";
  readonly btn = "inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-cta px-4 text-sm font-semibold text-white hover:bg-cta-hover disabled:opacity-70";
  busy = signal("");
  readonly fieldMt = `mt-1.5 ${this.field}`;
  workspaceId = "";
  customDomain = "";
  alertEmail = "";
  hashName = "";
  hashTags = "";
  private hashtags: { id: string; name: string; tags: string }[] = [];
  channelId = "";
  rssChannelId = "";
  rssGroupId = "";
  sigName = "";
  sigBody = "";
  sigDefault = false;
  setName = "";
  setTemplate = "";
  groupName = "";
  brandQuery = signal("");
  openBrandId = signal("");
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
  groupQuery = signal<Record<string, string>>({});
  groupNote = signal<Record<string, string>>({});
  groupErr = signal<Record<string, boolean>>({});
  savingGroup = signal("");
  feeds = signal<{ id: string; url: string }[]>([]);
  plugs = signal<{ id: string; name: string; scope: string; triggerType: string }[]>([]);
  tokens = signal<{ id: string; name: string; tokenPrefix: string }[]>([]);
  hooks = signal<{ id: string; name: string; url: string }[]>([]);
  newToken = signal("");
  sessionReady = signal(false);
  section = signal("workspace");
  readonly sections = [
    { id: "workspace", label: "Workspace" },
    { id: "signatures", label: "Signatures" },
    { id: "sets", label: "Posting sets" },
    { id: "groups", label: "Client brands" },
    { id: "rss", label: "RSS" },
    { id: "plugs", label: "Plugs" },
    { id: "tokens", label: "API tokens" },
    { id: "webhooks", label: "Webhooks" },
  ];
  idCopied = signal(false);
  private copyTimer: ReturnType<typeof setTimeout> | null = null;

  async ngOnInit() {
    try {
      const me = await api<{ workspace: { id: string; theme?: string; extrasJson?: string | null } }>("/v1/workspaces/me");
      this.workspaceId = me.workspace.id;
      try {
        const extras = JSON.parse(me.workspace.extrasJson || "{}") as {
          customDomain?: string;
          alertEmail?: string;
          hashtags?: { id: string; name: string; tags: string }[];
        };
        this.customDomain = extras.customDomain || "";
        this.alertEmail = extras.alertEmail || "";
        this.hashtags = extras.hashtags || [];
      } catch {
        this.hashtags = [];
      }
      setDarkClass(me.workspace.theme === "dark");
      const ac = await apiAll<{ id: string; network: string; handle: string }>(`/v1/accounts?workspaceId=${this.workspaceId}`, "accounts");
      this.accounts.set(ac);
      this.channelId = ac[0]?.id || "";
      this.rssChannelId = ac[0]?.id || "";
      await this.reload();
    } catch {
      /* unauthenticated — Workspace ID row explains sign-in */
    } finally {
      this.sessionReady.set(true);
    }
  }

  private async mark(key: string, work: () => Promise<void>) {
    if (this.busy()) return;
    this.busy.set(key);
    try {
      await work();
    } finally {
      this.busy.set("");
    }
  }

  async saveStudio() {
    await this.mark("studio", async () => {
    const hashtags = this.hashName.trim()
      ? [...this.hashtags, { id: crypto.randomUUID(), name: this.hashName.trim(), tags: this.hashTags.trim() }]
      : this.hashtags;
    await api(`/v1/workspaces/${this.workspaceId}`, {
      method: "PATCH",
      json: { customDomain: this.customDomain, alertEmail: this.alertEmail, hashtags },
    });
    this.hashtags = hashtags;
    this.hashName = "";
    this.hashTags = "";
    });
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
    if (!groups.groups.some((g) => g.id === this.openBrandId())) this.openBrandId.set(groups.groups[0]?.id || "");
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

  visibleBrands() {
    const q = this.brandQuery().trim().toLowerCase();
    if (!q) return this.groups();
    return this.groups().filter((group) => group.name.toLowerCase().includes(q));
  }

  editedBrands() {
    if (this.groups().length <= 3) return this.groups();
    const id = this.openBrandId() || this.groups()[0]?.id;
    const group = this.groups().find((row) => row.id === id);
    return group ? [group] : [];
  }

  pickBrand(id: string) {
    this.openBrandId.set(id);
  }

  brandOpen(id: string) {
    return (this.openBrandId() || this.groups()[0]?.id) === id;
  }

  accountCount(id: string) {
    const n = (this.groupDraft()[id] || []).length;
    return `${n} account${n === 1 ? "" : "s"}`;
  }

  setGroupQuery(groupId: string, value: string) {
    this.groupQuery.set({ ...this.groupQuery(), [groupId]: value });
  }

  assignedTo(groupId: string) {
    const ids = new Set(this.groupDraft()[groupId] || []);
    return this.accounts().filter((account) => ids.has(account.id));
  }

  accountMatches(groupId: string) {
    const q = (this.groupQuery()[groupId] || "").trim().toLowerCase();
    if (!q) return [];
    const ids = new Set(this.groupDraft()[groupId] || []);
    return this.accounts()
      .filter((account) => !ids.has(account.id) && (account.handle.toLowerCase().includes(q) || this.labelNetwork(account.network).toLowerCase().includes(q)))
      .slice(0, 8);
  }

  async saveGroupAccounts(groupId: string) {
    if (!this.workspaceId) {
      this.groupErr.set({ ...this.groupErr(), [groupId]: true });
      this.groupNote.set({ ...this.groupNote(), [groupId]: "Sign in to save this brand." });
      return;
    }
    this.savingGroup.set(groupId);
    try {
      await api(`/v1/org/groups/${groupId}/accounts`, {
        method: "PUT",
        json: { workspaceId: this.workspaceId, accountIds: this.groupDraft()[groupId] || [] },
      });
      await this.reload();
      const count = (this.groupDraft()[groupId] || []).length;
      this.groupErr.set({ ...this.groupErr(), [groupId]: false });
      this.groupNote.set({ ...this.groupNote(), [groupId]: count ? `Saved ${count} account${count === 1 ? "" : "s"}.` : "Saved. This brand has no accounts yet." });
    } catch {
      this.groupErr.set({ ...this.groupErr(), [groupId]: true });
      this.groupNote.set({ ...this.groupNote(), [groupId]: "Could not save. Try again." });
    } finally {
      this.savingGroup.set("");
    }
  }

  channelCount(json: string) {
    try {
      return (JSON.parse(json) as string[]).length;
    } catch {
      return 0;
    }
  }

  async addSig() {
    await this.mark("sig", async () => {
    await api("/v1/org/signatures", {
      method: "POST",
      json: { workspaceId: this.workspaceId, name: this.sigName, body: this.sigBody, isDefault: this.sigDefault },
    });
    this.sigName = "";
    this.sigBody = "";
    this.sigDefault = false;
    await this.reload();
    });
  }

  async setDefaultSig(id: string) {
    await api(`/v1/org/signatures/${id}/default?workspaceId=${this.workspaceId}`, { method: "POST" });
    await this.reload();
  }

  async addSet() {
    if (!this.setChannels().length) return;
    await this.mark("set", async () => {
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
    });
  }

  async addGroup() {
    await this.mark("group", async () => {
    await api("/v1/org/groups", { method: "POST", json: { workspaceId: this.workspaceId, name: this.groupName } });
    this.groupName = "";
    await this.reload();
    });
  }
  async addRss() {
    if (!this.rssChannelId && !this.rssGroupId) return;
    await this.mark("rss", async () => {
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
    });
  }
  async addPlug(scope: "internal" | "global") {
    await this.mark("plug", async () => {
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
    });
  }
  async runPlug(id: string) {
    await api(`/v1/org/plugs/${id}/run?workspaceId=${this.workspaceId}`, { method: "POST" });
  }
  async createToken() {
    await this.mark("token", async () => {
    const r = await api<{ token: string }>("/v1/org/tokens", {
      method: "POST",
      json: { workspaceId: this.workspaceId, name: "CLI" },
    });
    this.newToken.set(r.token);
    await this.reload();
    });
  }
  async addHook() {
    await this.mark("hook", async () => {
    await api("/v1/org/integrations", {
      method: "POST",
      json: { workspaceId: this.workspaceId, name: this.hookName, url: this.hookUrl },
    });
    this.hookName = "";
    this.hookUrl = "";
    await this.reload();
    });
  }
}
