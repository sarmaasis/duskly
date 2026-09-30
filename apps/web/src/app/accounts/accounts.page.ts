import { Component, computed, effect, ElementRef, inject, signal, viewChild, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { api, apiBase, type PlanSnapshot } from "../lib/api";
import { labelStatus } from "../lib/labels";
import { CompanyDesk } from "../lib/company-desk";
import { Notices } from "../lib/notices";
import { DkSelect, FIELD } from "../ui/forms";
import { Spinner } from "../ui/spinner";
import { ScrollMore } from "../ui/scroll-more";

type NetMeta = { label: string; group: "social" | "blogs" | "chat"; connect: "oauth" | "token" };
type AccountRow = {
  id: string;
  network: string;
  handle: string;
  status: string;
  groupId: string | null;
  slackChannelId?: string | null;
  slackChannelName?: string | null;
  needsSlackChannel?: boolean;
  needsPage?: boolean;
  needsPublishPermission?: boolean;
  pendingPages?: { id: string; name: string }[];
  tokenExpiresAt?: number | null;
  tokenExpired?: boolean;
  lastError?: string | null;
  queueSlots?: string | null;
  avatarUrl?: string | null;
};
type Company = { id: string; name: string; accountIds: string[] };
type SlackChannel = { id: string; name: string; isPrivate: boolean };

const FALLBACK_META: Record<string, NetMeta> = {
  linkedin: { label: "LinkedIn", group: "social", connect: "oauth" },
  "linkedin-page": { label: "LinkedIn Page", group: "social", connect: "oauth" },
  x: { label: "X", group: "social", connect: "oauth" },
  instagram: { label: "Instagram", group: "social", connect: "oauth" },
  threads: { label: "Threads", group: "social", connect: "oauth" },
  facebook: { label: "Facebook", group: "social", connect: "oauth" },
  youtube: { label: "YouTube", group: "social", connect: "oauth" },
  reddit: { label: "Reddit", group: "social", connect: "oauth" },
  bluesky: { label: "Bluesky", group: "social", connect: "token" },
  mastodon: { label: "Mastodon", group: "social", connect: "oauth" },
  hashnode: { label: "Hashnode", group: "blogs", connect: "token" },
  devto: { label: "dev.to", group: "blogs", connect: "token" },
  telegram: { label: "Telegram", group: "chat", connect: "token" },
  discord: { label: "Discord", group: "chat", connect: "token" },
  slack: { label: "Slack", group: "chat", connect: "oauth" },
};

@Component({
  standalone: true,
  imports: [FormsModule, DkSelect, Spinner, ScrollMore],
  template: `
    <div class="mx-auto max-w-6xl">
      <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-cta">Publishing</p>
          <h1 class="mt-1 font-display text-3xl font-bold tracking-tight text-ink dark:text-zinc-50">Accounts</h1>
          <p class="mt-1 max-w-xl text-sm text-muted dark:text-zinc-400">
            Connect the accounts you want to publish to. You can organize them into companies later.
          </p>
        </div>
      </div>

      @if (msg()) {
        <p class="mb-4 rounded-xl border border-[#e8e8e3] bg-white px-4 py-3 text-[13px] shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">{{ msg() }}</p>
      }

      <div class="space-y-5">
        <details class="rounded-xl border border-[#e8e8e3] bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <summary class="cursor-pointer text-sm font-semibold">Organize by company <span class="ml-2 text-xs font-normal text-muted">Optional</span></summary>
          <p class="mt-1 text-[13px] leading-relaxed text-[#63676c] dark:text-zinc-400">A company is a client or brand inside this workspace. Add one here, then pick it from the list or the sidebar.</p>
          <form class="mt-4 space-y-2" (ngSubmit)="createCompany()">
            <label class="block text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">New company
              <input [(ngModel)]="companyName" name="companyName" placeholder="Acme Co" [class]="'mt-1 ' + field" />
            </label>
            <button type="submit" class="inline-flex h-10 w-full items-center justify-center rounded-full bg-cta px-4 text-sm font-semibold text-white hover:bg-cta-hover">Add company</button>
          </form>
        </details>
        <div class="min-w-0 space-y-4">

      <dialog
        #connectPanel
        aria-labelledby="connect-dialog-title"
        (close)="onConnectClosed()"
        (click)="onConnectBackdrop($event)"
        class="m-auto w-[calc(100%-2rem)] max-w-lg max-h-[85dvh] overflow-y-auto rounded-2xl border border-[#e8e8e3] bg-white p-5 text-[#121417] shadow-xl backdrop:bg-black/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      >
      <form class="space-y-5" (ngSubmit)="connect()">
        <div class="flex items-center justify-between gap-3">
          <h2 id="connect-dialog-title" class="text-sm font-semibold text-[#121417] dark:text-zinc-100">{{ labelOf(network) }}</h2>
          <button type="button" (click)="closeConnect()" class="text-xs font-semibold text-[#52525b]">Cancel</button>
        </div>

        @if (companies().length) {
          <label class="block text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Company
            <dk-select [(ngModel)]="connectCompanyId" name="connectCompany" class="mt-1 block">
              <option value="">Unassigned</option>
              @for (c of companies(); track c.id) {
                <option [value]="c.id">{{ c.name }}</option>
              }
            </dk-select>
          </label>
        }

        @if (isToken()) {
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">
              {{ handleLabel() }}
              <input [(ngModel)]="handle" name="handle" required [class]="'mt-1 ' + field" />
            </label>

            @if (network === 'bluesky') {
              <label class="text-[11px] font-semibold text-[#71717a] sm:col-span-2 dark:text-zinc-400">App password
                <input [(ngModel)]="appPassword" name="pass" type="password" [class]="'mt-1 ' + field" />
              </label>
            }
            @if (network === 'devto' || network === 'hashnode') {
              <label class="text-[11px] font-semibold text-[#71717a] sm:col-span-2 dark:text-zinc-400">API key
                <input [(ngModel)]="apiKey" name="apiKey" type="password" [class]="'mt-1 ' + field" />
              </label>
            }
            @if (network === 'hashnode') {
              <label class="text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Publication ID
                <input [(ngModel)]="publicationId" name="pub" [class]="'mt-1 ' + field" />
              </label>
            }
            @if (network === 'telegram') {
              <label class="text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Bot token
                <input [(ngModel)]="botToken" name="bot" type="password" [class]="'mt-1 ' + field" />
              </label>
              <label class="text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Chat ID
                <input [(ngModel)]="chatId" name="chat" [class]="'mt-1 ' + field" />
              </label>
            }
            @if (network === 'discord') {
              <label class="text-[11px] font-semibold text-[#71717a] sm:col-span-2 dark:text-zinc-400">Webhook URL
                <input [(ngModel)]="webhookUrl" name="hook" type="url" [class]="'mt-1 ' + field" />
              </label>
            }
          </div>
          <button type="submit" [disabled]="connecting()" [attr.aria-busy]="connecting()" class="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-cta px-5 text-sm font-semibold text-white hover:bg-cta-hover disabled:opacity-70">
            @if (connecting()) { <dk-spinner /> }
            {{ replaceId ? 'Replace' : 'Connect' }} {{ labelOf(network) }}
          </button>
        } @else {
          @if (network === 'mastodon') {
            <label class="block text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Instance URL
              <input [(ngModel)]="mastodonInstance" name="instance" [class]="'mt-1 ' + field" />
            </label>
          }
          @if (network === 'reddit') {
            <label class="block text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Default subreddit (optional)
              <input [(ngModel)]="subreddit" name="sub" placeholder="r/something" [class]="'mt-1 ' + field" />
            </label>
          }
          <button type="button" (click)="oauthConnect()" [disabled]="!oauthReady()[network] || connecting()" [attr.aria-busy]="connecting()" class="disabled:cursor-not-allowed disabled:opacity-50 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-cta px-5 text-sm font-semibold text-white hover:bg-cta-hover">
            @if (connecting()) { <dk-spinner /> }
            @if (network === 'slack') {
              <img src="/assets/logos/slack.svg" alt="" width="16" height="16" class="size-4 object-contain" aria-hidden="true" />
              Add to Slack
            } @else {
              {{ replaceId ? 'Replace' : 'Connect' }} with {{ labelOf(network) }}
            }
          </button>
          @if (network === 'slack') {
            <p class="text-[12px] text-[#63676c] dark:text-zinc-400">The bot posts to the public channel you picked before the bot is invited, which is why chat:write.public is requested.</p>
          }
          @if (network === 'instagram') {
            <p class="text-[12px] text-[#63676c] dark:text-zinc-400">Connects a professional Instagram account (Business or Creator). Instagram Login does not need a Facebook Page or shared Facebook login.</p>
          }
          @if (!oauthReady()[network]) {
            <p class="text-[12px] text-amber-700 dark:text-amber-400">
              @if (network === 'slack') {
                Slack is not ready on this instance. Ask the instance owner to enable the Slack integration.
              } @else {
                {{ labelOf(network) }} is not ready on this instance. Ask the instance owner to enable this integration, or choose another network.
              }
            </p>
          }
        }
      </form>
      </dialog>

      <section>
        <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <input
            [ngModel]="boardQuery()"
            (ngModelChange)="searchBoard($event)"
            name="boardQuery"
            placeholder="Search handle…"
            [class]="'sm:w-44 ' + field"
          />
          <dk-select [ngModel]="filterNetwork()" (ngModelChange)="filterNetwork.set($event)" name="filterNetwork" class="sm:w-40">
            <option value="">All networks</option>
            @for (n of networks(); track n) {
              <option [value]="n">{{ labelOf(n) }}</option>
            }
          </dk-select>
        </div>

        @if (companies().length > 1) {
          <div class="mb-4 flex flex-wrap gap-2">
            <button type="button" (click)="pickCompany('')" [attr.aria-pressed]="!filterCompany()" class="h-8 rounded-full px-3 text-xs font-semibold" [class.bg-cta]="!filterCompany()" [class.text-white]="!filterCompany()" [class.text-[#52525b]]="!!filterCompany()">All companies</button>
            @for (company of companies(); track company.id) {
              <button type="button" (click)="pickCompany(company.id)" [attr.aria-pressed]="filterCompany()===company.id" class="h-8 rounded-full px-3 text-xs font-semibold" [class.bg-cta]="filterCompany()===company.id" [class.text-white]="filterCompany()===company.id" [class.text-[#52525b]]="filterCompany()!==company.id">{{ company.name }}</button>
            }
          </div>
        }

        @if (filterCompany() && !boardQuery().trim() && !filterNetwork() && !filteredAccounts().length && !loading()) {
          <p class="mb-2 text-sm text-[#63676c] dark:text-zinc-400">No accounts in this company yet. Connect one below. It will be added to this company.</p>
        }
        <div class="divide-y divide-[#e8e8e3] dark:divide-zinc-800">
          @if (loading()) {
            <div class="flex justify-center py-8 text-cta"><dk-spinner [size]="20" label="Loading" /></div>
          }
          @for (row of networkRows(); track row.network) {
            <div class="flex flex-wrap items-center gap-2 py-3">
              <button type="button" (click)="connectNetwork(row.network)" [attr.aria-label]="'Add a ' + labelOf(row.network) + ' account'" class="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-[#e8e8e3] bg-white px-3 text-xs font-semibold text-[#121417] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
                <img [src]="logoSrc(row.network)" alt="" width="16" height="16" class="size-4 object-contain" />
                Connect {{ labelOf(row.network) }}
              </button>
              @for (a of row.accounts; track a.id) {
                <span class="inline-flex items-center rounded-full border bg-white dark:bg-zinc-950" [class.border-cta]="focusedId() === a.id" [class.border-[#e8e8e3]]="focusedId() !== a.id" [class.dark:border-zinc-700]="focusedId() !== a.id">
                  <button type="button" (click)="focus(a.id)" [attr.aria-pressed]="focusedId() === a.id" [attr.aria-label]="labelOf(a.network) + ' ' + a.handle" class="inline-flex h-10 items-center gap-2 pl-1 pr-2">
                    <span class="relative size-7 shrink-0">
                      <span class="flex size-full items-center justify-center overflow-hidden rounded-full bg-white text-[11px] font-bold text-cta">
                        @if (a.avatarUrl) { <img [src]="a.avatarUrl" alt="" class="size-full object-cover" /> } @else { <img [src]="logoSrc(a.network)" alt="" width="16" height="16" class="dk-net-badge size-4 object-contain" /> }
                      </span>
                      @if (a.avatarUrl) {
                        <span class="absolute -right-1.5 -top-1.5 z-10 flex size-4 items-center justify-center rounded-full bg-white shadow-sm ring-2 ring-white dark:ring-zinc-900">
                          <img [src]="logoSrc(a.network)" alt="" width="12" height="12" class="dk-net-badge size-3 object-contain" />
                        </span>
                      }
                    </span>
                    <span class="max-w-40 truncate text-xs font-semibold text-[#121417] dark:text-zinc-100">{{ a.handle }}</span>
                  </button>
                  <button type="button" (click)="remove(a.id)" [attr.aria-label]="'Remove ' + a.handle" class="px-2 text-xs text-zinc-400">×</button>
                </span>
                @if (a.network === 'slack' && a.needsSlackChannel) {
                  <label class="inline-flex items-center gap-2 text-[11px] font-semibold text-[#52525b] dark:text-zinc-400">
                    Channel
                    <select
                      [attr.aria-label]="'Slack channel for ' + a.handle"
                      class="h-8 max-w-52 rounded-full border border-[#e8e8e3] bg-white px-2 text-[12px] dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                      [ngModel]="''"
                      (focus)="loadSlackChannels(a.id)"
                      (ngModelChange)="pickSlackChannel(a.id, $event)"
                      [name]="'slack-row-' + a.id"
                    >
                      <option value="">Pick a channel…</option>
                      @for (ch of slackChannels()[a.id] || []; track ch.id) {
                        <option [value]="ch.id">#{{ ch.name }}</option>
                      }
                    </select>
                  </label>
                  @if (slackChannels()[a.id] && !slackChannels()[a.id].length) {
                    <button type="button" (click)="reconnect(a)" class="text-xs font-semibold text-cta">Reconnect Slack</button>
                  }
                }
              }
            </div>
          } @empty {
            @if (!loading()) {
              <p class="py-8 text-sm text-[#63676c] dark:text-zinc-400">{{ accounts().length ? 'No accounts match that search.' : 'Use Connect on a network below.' }}</p>
            }
          }
        </div>
        <div class="flex h-10 items-center justify-center" dkScrollMore [dkScrollEnabled]="accountsNext() != null" [dkScrollBusy]="paging()" (dkScrollMoreFire)="moreAccounts()">
          @if (paging()) { <dk-spinner [size]="16" label="Loading more" /> }
        </div>
          @if (focusedAccount(); as a) {
            <article class="mt-4 space-y-3 rounded-2xl border border-[#e8e8e3] bg-[#fcfcf9] p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <div class="flex items-center gap-3">
                <span class="relative size-10 shrink-0">
                  <span class="flex size-full items-center justify-center overflow-hidden rounded-full bg-white text-sm font-bold text-cta">
                    @if (a.avatarUrl) { <img [src]="a.avatarUrl" alt="" class="size-full object-cover" /> } @else { <img [src]="logoSrc(a.network)" alt="" width="22" height="22" class="dk-net-badge size-6 object-contain" /> }
                  </span>
                  @if (a.avatarUrl) {
                    <span class="absolute -right-1 -top-1 z-10 flex size-5 items-center justify-center rounded-full bg-white shadow-sm ring-2 ring-white dark:ring-zinc-900">
                      <img [src]="logoSrc(a.network)" alt="" width="14" height="14" class="dk-net-badge size-3.5 object-contain" />
                    </span>
                  }
                </span>
                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold dark:text-zinc-100">{{ a.handle }}</p>
                  <p class="text-[12px] text-[#63676c] dark:text-zinc-400">{{ labelOf(a.network) }} · {{ a.tokenExpired ? 'Expired' : statusLabel(a.status) }}</p>
                </div>
              </div>
              @if (companies().length) {
                <select
                  [attr.aria-label]="'Company for ' + a.handle"
                  class="h-8 w-full appearance-none rounded-md border border-[#e8e8e3] bg-white px-2 text-[12px] outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  [ngModel]="a.groupId || ''"
                  (ngModelChange)="assignCompany(a.id, $event)"
                  [name]="'co-' + a.id"
                >
                  <option value="">Unassigned</option>
                  @for (c of companies(); track c.id) {
                    <option [value]="c.id">{{ c.name }}</option>
                  }
                </select>
              }
              @if (a.network === 'slack') {
                <select
                  class="h-8 w-full appearance-none rounded-md border border-[#e8e8e3] bg-white px-2 text-[12px] outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  [ngModel]="a.slackChannelId || ''"
                  (focus)="loadSlackChannels(a.id)"
                  (ngModelChange)="pickSlackChannel(a.id, $event)"
                  [name]="'slack-' + a.id"
                >
                  <option value="">{{ a.needsSlackChannel ? 'Pick a channel…' : (a.slackChannelName ? '#' + a.slackChannelName : 'Change channel…') }}</option>
                  @for (ch of slackChannels()[a.id] || []; track ch.id) {
                    <option [value]="ch.id">#{{ ch.name }}</option>
                  }
                </select>
              } @else if (a.needsPage) {
                <dk-select [ngModel]="''" (ngModelChange)="pickPage(a.id, $event)" [name]="'page-' + a.id">
                  <option value="">{{ a.network === 'instagram' ? 'Pick an Instagram account…' : a.network === 'linkedin-page' ? 'Pick a LinkedIn Page…' : 'Pick a Page…' }}</option>
                  @for (p of a.pendingPages || []; track p.id) {
                    <option [value]="p.id">{{ p.name }}</option>
                  }
                </dk-select>
              }
              <label class="block text-[11px] text-[#71717a]">Queue slots
                <input [value]="a.queueSlots || ''" (change)="saveSlots(a.id, $any($event.target).value)" placeholder="09:00,13:00,18:00" class="mt-1 h-8 w-full rounded-md border border-[#e8e8e3] bg-white px-2 text-[12px] dark:border-zinc-600 dark:bg-zinc-800" />
              </label>
              @if (a.tokenExpiresAt) {
                <p class="text-[11px] text-[#71717a]">Token until {{ tokenWhen(a.tokenExpiresAt) }}</p>
              }
              @if (a.lastError) {
                <p class="line-clamp-2 text-[12px] text-amber-800 dark:text-amber-200">{{ a.lastError }}</p>
              }
              <div class="flex flex-wrap gap-3">
                @if (a.tokenExpired || a.status !== 'active') {
                  <button type="button" (click)="reconnect(a)" class="text-xs font-semibold text-cta">Reconnect</button>
                }
                @if (a.needsPublishPermission) {
                  <button type="button" (click)="enableLinkedInPublishing(a)" class="text-xs font-semibold text-cta">Enable publishing</button>
                }
                <button type="button" (click)="remove(a.id)" class="inline-flex h-8 items-center rounded-full border border-red-200 px-3 text-[11px] font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950">Remove</button>
              </div>
            </article>
          }
      </section>
        </div>
      </div>
    </div>
  `,
})
export class AccountsPage implements OnInit {
  private readonly notices = inject(Notices);
  readonly field = FIELD;
  readonly netGroups = [
    { id: "social" as const, label: "Social" },
    { id: "blogs" as const, label: "Blogs" },
    { id: "chat" as const, label: "Chat" },
  ];
  accounts = signal<AccountRow[]>([]);
  companies = signal<Company[]>([]);
  slackChannels = signal<Record<string, SlackChannel[]>>({});
  networks = signal<string[]>(Object.keys(FALLBACK_META));
  meta = signal<Record<string, NetMeta>>(FALLBACK_META);
  oauthReady = signal<Record<string, boolean>>({});
  usage = signal<PlanSnapshot | null>(null);
  network = "linkedin";
  handle = "";
  appPassword = "";
  apiKey = "";
  botToken = "";
  chatId = "";
  webhookUrl = "";
  publicationId = "";
  subreddit = "";
  mastodonInstance = "https://mastodon.social";
  connectCompanyId = "";
  companyName = "";
  adding = signal(false);
  private readonly connectPanel = viewChild<ElementRef<HTMLDialogElement>>("connectPanel");
  loading = signal(true);
  connecting = signal(false);
  boardQuery = signal("");
  accountsNext = signal<number | null>(null);
  paging = signal(false);
  filterNetwork = signal("");
  filterCompany = signal("");
  focusedId = signal("");
  readonly desk = inject(CompanyDesk);
  workspaceId = "";
  msg = signal("");

  filteredAccounts = computed(() => {
    const q = this.boardQuery().trim().toLowerCase();
    const net = this.filterNetwork();
    const co = this.filterCompany();
    return this.accounts().filter((a) => {
      if (net && a.network !== net) return false;
      if (co === "__none__" && a.groupId) return false;
      if (co && co !== "__none__" && a.groupId !== co) return false;
      if (q && !a.handle.toLowerCase().includes(q) && !this.labelOf(a.network).toLowerCase().includes(q)) return false;
      return true;
    });
  });

  companyFilters = computed(() => {
    const rows = this.accounts();
    return [
      { id: "", name: "All companies", count: rows.length },
      { id: "__none__", name: "Unassigned", count: rows.filter((a) => !a.groupId).length },
      ...this.companies().map((company) => ({
        id: company.id,
        name: company.name,
        count: rows.filter((a) => a.groupId === company.id).length,
      })),
    ];
  });

  browsingCompanies = computed(() => {
    if (this.filterCompany() || this.filterNetwork() || this.accounts().length <= 8) return false;
    const q = this.boardQuery().trim().toLowerCase();
    if (!q) return true;
    return !this.accounts().some((account) => account.handle.toLowerCase().includes(q) || this.labelOf(account.network).toLowerCase().includes(q));
  });

  visibleCompanies = computed(() => {
    const q = this.boardQuery().trim().toLowerCase();
    return this.companyFilters().filter((company) => company.id && (!q || company.name.toLowerCase().includes(q)) && (company.id !== "__none__" || company.count > 0));
  });

  focusedAccount = computed(() => this.filteredAccounts().find((a) => a.id === this.focusedId()) ?? null);

  focus(id: string) {
    this.focusedId.set(this.focusedId() === id ? "" : id);
  }

  mark(handle: string) {
    const name = handle.replace(/^[@#]/, "").trim();
    return (name[0] || "?").toUpperCase();
  }

  networkRows = computed(() => {
    const accounts = this.filteredAccounts();
    const narrowing = !!(this.boardQuery().trim() || this.filterNetwork());
    return this.networks()
      .map((network) => ({ network, accounts: accounts.filter((account) => account.network === network) }))
      .filter((row) => !narrowing || row.accounts.length);
  });

  connectNetwork(network: string) {
    this.pickNetwork(network);
    this.replaceId = "";
    this.handle = "";
    const company = this.filterCompany();
    this.connectCompanyId = company && company !== "__none__" ? company : "";
    const needsFields = this.isToken() || network === "mastodon" || network === "reddit";
    const askCompany = !this.connectCompanyId && this.companies().length > 0;
    if (needsFields || askCompany) {
      this.adding.set(true);
      return;
    }
    this.adding.set(false);
    this.oauthConnect();
  }

  closeConnect() {
    this.adding.set(false);
    this.replaceId = "";
  }

  onConnectClosed() {
    if (!this.adding()) return;
    this.adding.set(false);
    this.replaceId = "";
  }

  onConnectBackdrop(ev: MouseEvent) {
    if (ev.target === ev.currentTarget) this.closeConnect();
  }

  channelSections = computed(() => {
    const rows = this.filteredAccounts();
    const co = this.filterCompany();
    if (!rows.length) return [];
    if (co === "__none__") return [{ id: "__none__", name: "Your accounts", accounts: rows }];
    if (co) {
      const company = this.companies().find((item) => item.id === co);
      return [{ id: co, name: company?.name || "Company", accounts: rows }];
    }
    const sections = this.companies()
      .map((company) => ({
        id: company.id,
        name: company.name,
        accounts: rows.filter((account) => account.groupId === company.id),
      }))
      .filter((section) => section.accounts.length);
    const loose = rows.filter((account) => !account.groupId);
    if (loose.length) sections.push({ id: "__none__", name: "Your accounts", accounts: loose });
    return sections.length ? sections : [{ id: "", name: "Channels", accounts: rows }];
  });

  addGroup = signal<"social" | "blogs" | "chat">("social");

  constructor(private route: ActivatedRoute) {
    effect(() => {
      const id = this.desk.selectedId();
      if (this.filterCompany() === "__none__" && !id) return;
      this.filterCompany.set(id);
    });
    effect(() => {
      const open = this.adding();
      const panel = this.connectPanel()?.nativeElement;
      if (!panel || typeof panel.showModal !== "function") return;
      if (open && !panel.open) panel.showModal();
      else if (!open && panel.open) panel.close();
    });
    if (typeof window !== "undefined") {
      this.capturedOauthQuery = new URLSearchParams(window.location.search);
      if (window.location.hash === "#_=_") {
        window.history.replaceState(
          window.history.state,
          document.title,
          `${window.location.pathname}${window.location.search}`,
        );
      }
    }
  }

  private capturedOauthQuery: URLSearchParams | null = null;

  oauthQuery(name: string): string | null {
    const fromWindow = this.capturedOauthQuery?.get(name) || null;
    if (fromWindow) return fromWindow;
    if (typeof window !== "undefined") {
      const live = new URLSearchParams(window.location.search).get(name);
      if (live) return live;
    }
    return this.route.snapshot.queryParamMap.get(name);
  }

  logoSrc(n: string) {
    return `/assets/logos/${n}.svg`;
  }

  networksIn(group: "social" | "blogs" | "chat") {
    return this.networks().filter((n) => (this.meta()[n] || FALLBACK_META[n])?.group === group);
  }

  labelOf(n: string) {
    return this.meta()[n]?.label || FALLBACK_META[n]?.label || n;
  }

  statusLabel(status: string) {
    return labelStatus(status);
  }

  isToken() {
    return (this.meta()[this.network] || FALLBACK_META[this.network])?.connect === "token";
  }

  handleLabel() {
    if (this.network === "discord") return "Label";
    if (this.network === "telegram") return "Bot / channel label";
    if (this.network === "reddit") return "Handle";
    return "Handle / display name";
  }

  oauthFailureMessage(oauth: string, network: string | null, reason: string | null, detail: string | null) {
    const instagram = network === "instagram";
    const threads = network === "threads";
    const facebook = !network || network === "facebook" || network === "instagram";
    if (reason === "not_professional") {
      return "Instagram requires a professional (Business or Creator) account — personal accounts cannot be connected.";
    }
    if ((reason === "access_denied" || reason === "user_denied" || reason === "interaction_required") && (network === "linkedin" || network === "linkedin-page")) {
      return network === "linkedin-page"
        ? "LinkedIn Page login was cancelled or the Page app rejected the requested permissions."
        : "LinkedIn login was cancelled or permissions were denied.";
    }
    if (reason === "access_denied" || reason === "user_denied") {
      return facebook
        ? instagram
          ? "Instagram login was cancelled or permissions were denied."
          : "Facebook login was cancelled or permissions were denied."
        : "OAuth failed — credentials or consent rejected";
    }
    if (reason === "redirect_uri") {
      if (threads) return "Threads rejected the token exchange — add the Threads callback URL in the Threads API settings.";
      return instagram
        ? "Instagram rejected the token exchange — add the callback under Instagram → API setup with Instagram login → OAuth redirect URIs."
        : "Facebook rejected the token exchange — the redirect URI must match the authorize URL exactly.";
    }
    if (reason === "bad_secret" || reason === "missing_secret") {
      if (threads) return "Threads rejected the app secret. Check THREADS_APP_ID and THREADS_APP_SECRET on the API.";
      return instagram
        ? "Instagram rejected the app secret. Check INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET on the API."
        : "Facebook rejected the app secret. Check META_APP_ID and META_APP_SECRET on the API.";
    }
    if (reason === "threads_basic") {
      return detail || "Threads requires tester access or App Review approval. Add the account as a Threads Tester, accept the invite, then reconnect Threads.";
    }
    if (reason === "code_used") return "Facebook authorization code was already used. Connect again from Accounts.";
    if (reason === "code_expired" || reason === "bad_code") {
      return "Facebook authorization code was invalid or expired. Connect again from Accounts.";
    }
    if (reason === "no_page") {
      if (network === "linkedin-page") {
        return "No LinkedIn Page was found. You need to be an admin or content admin, and the Page app needs rw_organization_admin.";
      }
      return network === "instagram"
        ? "No Facebook Page with a linked Instagram professional account was found."
        : "No Facebook Pages were found on that account.";
    }
    if (reason === "scopes" && (network === "linkedin" || network === "linkedin-page")) {
      return detail
        ? `LinkedIn did not grant ${detail}. Add those products on the matching LinkedIn app, then connect again.`
        : "LinkedIn did not grant the posting permissions. Check the app products, then connect again.";
    }
    if (reason === "pages" && network === "linkedin-page") {
      return "LinkedIn login succeeded, but Pages could not be loaded. Confirm the Page app has Community Management access.";
    }
    if (reason === "pages") {
      return detail
        ? `Facebook login succeeded but Pages could not be loaded. ${detail}`
        : "Facebook login succeeded but Pages could not be loaded.";
    }
    if (reason === "channel_limit") return "OAuth failed — this plan has no free channel slots.";
    if (reason === "encrypt") {
      if (!detail || detail === "missing") {
        return "Facebook connected, but Duskly could not encrypt the token. Set TOKEN_ENCRYPTION_KEY on the API.";
      }
      return `Facebook connected, but Duskly could not encrypt the token (${detail}).`;
    }
    if (reason === "persist") {
      return network === "instagram"
        ? "Instagram connected, but Duskly could not save the account. Try again."
        : "Facebook connected, but Duskly could not save the Page. Try again.";
    }
    if (reason === "kv" || reason === "bad_state" || reason === "callback") {
      return "OAuth state is invalid — try Facebook connect again.";
    }
    if (reason && /^graph_\d+$/.test(reason)) {
      const code = reason.slice("graph_".length);
      const label = instagram ? "Instagram" : threads ? "Threads" : "Facebook";
      return detail
        ? `${label} OAuth failed — Graph error ${code}: ${detail}`
        : `${label} OAuth failed — Graph error ${code}.`;
    }
    if (detail) {
      return instagram ? `Instagram OAuth failed — ${detail}` : threads ? `Threads OAuth failed — ${detail}` : `Facebook OAuth failed — ${detail}`;
    }
    if (reason && reason !== "token_failed" && reason !== "exchange" && reason !== "error") {
      return instagram ? `Instagram OAuth failed — ${reason}.` : threads ? `Threads OAuth failed — ${reason}.` : `Facebook OAuth failed — ${reason}.`;
    }
    if ((oauth === "token_failed" || reason === "token_failed" || reason === "exchange") && (network === "linkedin" || network === "linkedin-page")) {
      return network === "linkedin-page"
        ? "LinkedIn Page token exchange failed. Check LINKEDIN_PAGE_CLIENT_ID / LINKEDIN_PAGE_CLIENT_SECRET and the Page callback URL."
        : "LinkedIn token exchange failed. Check LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET and the member callback URL.";
    }
    if (oauth === "token_failed" || reason === "token_failed" || reason === "exchange") {
      if (threads) {
        return "Threads token exchange failed. Check THREADS_APP_ID / THREADS_APP_SECRET and the Threads OAuth redirect URI.";
      }
      return instagram
        ? "Instagram token exchange failed. Check INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET and the Instagram Login OAuth redirect URI."
        : "Facebook token exchange failed. Check the Meta app id/secret and Valid OAuth Redirect URI.";
    }
    return "OAuth failed — credentials or consent rejected";
  }

  pickCompany(id: string) {
    if (id === "__none__") {
      this.desk.select("");
      this.filterCompany.set("__none__");
      return;
    }
    this.desk.select(id);
  }

  pickNetwork(n: string) {
    this.network = n;
    const group = (this.meta()[n] || FALLBACK_META[n])?.group;
    if (group) this.addGroup.set(group);
  }

  async ngOnInit() {
    try {
      const me = await api<{ workspace: { id: string }; usage: PlanSnapshot }>("/v1/workspaces/me");
      this.workspaceId = me.workspace.id;
      this.usage.set(me.usage);
      const oauth = this.oauthQuery("oauth");
      const oauthNetwork = this.oauthQuery("network");
      const reason = this.oauthQuery("reason");
      const detail = this.oauthQuery("detail");
      const accountId = this.oauthQuery("accountId");
      if (oauth === "ok") {
        this.msg.set(
          oauthNetwork === "slack"
            ? "Slack is connected. Pick the channel these posts should go to."
            : oauthNetwork === "instagram"
              ? accountId
                ? "Instagram login succeeded — pick the Instagram account to connect."
                : "Instagram account connected"
              : oauthNetwork === "facebook"
                ? "Facebook connected — pick a Page if you have more than one."
                : "OAuth connected",
        );
      } else if (oauth === "no_page" || reason === "no_page") {
        this.msg.set(
          oauthNetwork === "linkedin-page"
            ? "No LinkedIn Page was found. You need to be an admin or content admin, and the Page app needs rw_organization_admin."
            : oauthNetwork === "instagram"
              ? "No Facebook Page with a linked Instagram professional account was found."
              : "No Facebook Pages were found on that account.",
        );
      } else if (oauth === "limit") this.msg.set("OAuth failed — this plan has no free channel slots.");
      else if (oauth === "error" || oauth === "token_failed") {
        this.msg.set(this.oauthFailureMessage(oauth, oauthNetwork, reason, detail));
      } else if (oauth === "expired") this.msg.set("OAuth state expired — try again");
      if (oauth && this.msg()) this.notices.push(oauth === "ok" ? "ok" : "error", this.msg());
      await this.reload();
      try {
        const st = await api<Record<string, boolean>>(`/v1/accounts/oauth/status?workspaceId=${this.workspaceId}`);
        this.oauthReady.set(st);
      } catch {
        /* ignore */
      }
      if (oauth === "ok" && oauthNetwork === "slack" && accountId) {
        this.focusedId.set(accountId);
        await this.loadSlackChannels(accountId);
      }
    } catch {
      this.msg.set("Sign in to connect accounts.");
    } finally {
      this.loading.set(false);
    }
  }

  async loadAccounts(offset = 0) {
    return api<{ accounts: AccountRow[]; networks: string[]; meta?: Record<string, NetMeta>; next?: number | null }>(
      `/v1/accounts?workspaceId=${this.workspaceId}&limit=40&offset=${offset}`,
    );
  }

  searchBoard(value: string) {
    this.boardQuery.set(value);
    if (value.trim()) void this.drainAccounts();
  }

  async drainAccounts() {
    for (let i = 0; i < 40 && this.accountsNext() != null; i++) await this.moreAccounts();
  }

  async moreAccounts() {
    const offset = this.accountsNext();
    if (offset == null || this.paging()) return;
    this.paging.set(true);
    try {
      const data = await this.loadAccounts(offset);
      this.accounts.update((rows) => rows.concat(data.accounts || []));
      if (data.networks?.length) this.networks.set(data.networks);
      if (data.meta) this.meta.set({ ...this.meta(), ...data.meta });
      this.accountsNext.set(typeof data.next === "number" ? data.next : null);
    } finally {
      this.paging.set(false);
    }
  }

  async reload() {
    const [data, groups, me] = await Promise.all([
      this.loadAccounts(),
      api<{ groups: Company[] }>(`/v1/org/groups?workspaceId=${this.workspaceId}`),
      api<{ usage: PlanSnapshot }>("/v1/workspaces/me").catch(() => null),
    ]);
    this.accounts.set(
      (data.accounts || []).map((a) => ({
        id: a.id,
        network: a.network,
        handle: a.handle,
        status: a.status,
        groupId: a.groupId ?? null,
        slackChannelId: a.slackChannelId ?? null,
        slackChannelName: a.slackChannelName ?? null,
        needsSlackChannel: !!a.needsSlackChannel,
        needsPage: !!a.needsPage,
        needsPublishPermission: !!a.needsPublishPermission,
        pendingPages: a.pendingPages || [],
        tokenExpiresAt: a.tokenExpiresAt ?? null,
        tokenExpired: !!a.tokenExpired,
        lastError: a.lastError ?? null,
        queueSlots: a.queueSlots ?? "",
        avatarUrl: a.avatarUrl ?? null,
      })),
    );
    this.accountsNext.set(typeof data.next === "number" ? data.next : null);
    this.networks.set(data.networks?.length ? data.networks : Object.keys(FALLBACK_META));
    if (data.meta) this.meta.set(data.meta);
    if (!this.networks().includes(this.network)) this.pickNetwork(this.networks()[0]);
    this.companies.set(
      (groups.groups || []).map((g) => ({
        id: g.id,
        name: g.name,
        accountIds: g.accountIds || [],
      })),
    );
    if (me?.usage) this.usage.set(me.usage);
    if (this.workspaceId) void this.desk.load(this.workspaceId);
    for (const account of this.accounts()) {
      if (account.needsSlackChannel) void this.loadSlackChannels(account.id);
    }
  }

  async saveSlots(id: string, queueSlots: string) {
    await api(`/v1/accounts/${id}`, { method: "PATCH", json: { workspaceId: this.workspaceId, queueSlots } });
    this.accounts.update((rows) => rows.map((row) => (row.id === id ? { ...row, queueSlots } : row)));
  }

  tokenWhen(ms: number) {
    return new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  replaceId = "";

  toggleAdd() {
    this.adding.set(!this.adding());
    if (!this.adding()) this.replaceId = "";
  }

  reconnect(account: AccountRow) {
    this.replaceId = account.id;
    this.network = account.network;
    this.handle = account.handle;
    this.connectCompanyId = account.groupId || this.connectCompanyId;
    if (this.isToken()) {
      this.adding.set(true);
      return;
    }
    this.oauthConnect();
  }

  oauthConnect() {
    if (!this.oauthReady()[this.network]) {
      this.msg.set(
        this.network === "slack"
          ? "SLACK_CLIENT_ID / SLACK_CLIENT_SECRET are not configured on the API."
          : `OAuth for ${this.labelOf(this.network)} is not configured on the API.`,
      );
      return;
    }
    const q = new URLSearchParams({ workspaceId: this.workspaceId });
    if (this.replaceId) q.set("replaceId", this.replaceId);
    if (this.network === "mastodon") q.set("instance", this.mastodonInstance);
    if (this.network === "reddit" && this.subreddit.trim()) q.set("subreddit", this.subreddit.trim());
    if (this.connectCompanyId) q.set("groupId", this.connectCompanyId);
    this.connecting.set(true);
    window.location.href = `${apiBase()}/v1/accounts/oauth/${this.network}/start?${q}`;
  }

  enableLinkedInPublishing(account: AccountRow) {
    if (!this.oauthReady().linkedin) {
      this.msg.set("OAuth for LinkedIn is not configured on the API.");
      return;
    }
    const q = new URLSearchParams({ workspaceId: this.workspaceId, replaceId: account.id, share: "1" });
    window.location.href = `${apiBase()}/v1/accounts/oauth/linkedin/start?${q}`;
  }

  async loadSlackChannels(accountId: string) {
    if (accountId in this.slackChannels()) return;
    try {
      const data = await api<{ channels: SlackChannel[] }>(
        `/v1/accounts/${accountId}/slack/channels?workspaceId=${this.workspaceId}`,
      );
      this.slackChannels.update((m) => ({ ...m, [accountId]: data.channels || [] }));
    } catch (e: unknown) {
      const err = e as { body?: { message?: string }; message?: string };
      this.msg.set(err.body?.message || err.message || "Could not load Slack channels");
    }
  }

  async pickPage(accountId: string, pageId: string) {
    if (!pageId) return;
    const instagram = this.accounts().find((a) => a.id === accountId)?.network === "instagram";
    try {
      await api(`/v1/accounts/${accountId}`, {
        method: "PATCH",
        json: { workspaceId: this.workspaceId, pageId },
      });
      this.msg.set(instagram ? "Instagram account selected" : "Page selected — posts will use that Page token");
      await this.reload();
    } catch (e: unknown) {
      const err = e as { body?: { message?: string }; message?: string };
      this.msg.set(err.body?.message || err.message || (instagram ? "Could not save Instagram account" : "Could not save Page"));
    }
  }

  async pickSlackChannel(accountId: string, channelId: string) {
    if (!channelId) return;
    const ch = (this.slackChannels()[accountId] || []).find((c) => c.id === channelId);
    try {
      const saved = await api<{ retried?: number }>(`/v1/accounts/${accountId}`, {
        method: "PATCH",
        json: {
          workspaceId: this.workspaceId,
          slackChannelId: channelId,
          slackChannelName: ch?.name,
        },
      });
      const where = ch ? `#${ch.name}` : "that channel";
      this.msg.set(saved.retried ? `Slack posts will go to ${where}. Sending the one that was waiting.` : `Slack posts will go to ${where}`);
      await this.reload();
    } catch (e: unknown) {
      const err = e as { body?: { message?: string }; message?: string };
      this.msg.set(err.body?.message || err.message || "Could not save Slack channel");
    }
  }

  async createCompany() {
    const name = this.companyName.trim();
    if (!name) return;
    try {
      await api("/v1/org/groups", { method: "POST", json: { workspaceId: this.workspaceId, name } });
      this.companyName = "";
      this.msg.set(`Company “${name}” created`);
      await this.reload();
    } catch (e: unknown) {
      const err = e as { body?: { message?: string }; message?: string };
      this.msg.set(err.body?.message || err.message || "Failed to create company");
    }
  }

  async assignCompany(accountId: string, groupId: string) {
    try {
      await api(`/v1/accounts/${accountId}`, {
        method: "PATCH",
        json: { workspaceId: this.workspaceId, groupId: groupId || null },
      });
      await this.reload();
    } catch (e: unknown) {
      const err = e as { body?: { message?: string }; message?: string };
      this.msg.set(err.body?.message || err.message || "Assign failed");
    }
  }

  async connect() {
    if (this.connecting()) return;
    this.connecting.set(true);
    try {
      await api("/v1/accounts", {
        method: "POST",
        json: {
          workspaceId: this.workspaceId,
          network: this.network,
          handle: this.handle,
          appPassword: this.appPassword || undefined,
          apiKey: this.apiKey || undefined,
          botToken: this.botToken || undefined,
          chatId: this.chatId || undefined,
          webhookUrl: this.webhookUrl || undefined,
          publicationId: this.publicationId || undefined,
          subreddit: this.subreddit || undefined,
          groupId: this.connectCompanyId || null,
          replaceId: this.replaceId || undefined,
        },
      });
      this.replaceId = "";
      this.handle = "";
      this.appPassword = "";
      this.apiKey = "";
      this.botToken = "";
      this.chatId = "";
      this.webhookUrl = "";
      this.publicationId = "";
      this.msg.set("Channel connected");
      this.notices.push("ok", "Channel connected");
      this.closeConnect();
      await this.reload();
    } catch (e: unknown) {
      const err = e as { body?: { message?: string }; message?: string };
      const text = err.body?.message || err.message || "Failed";
      this.msg.set(text);
      this.notices.push("error", text);
    } finally {
      this.connecting.set(false);
    }
  }

  async remove(id: string) {
    await api(`/v1/accounts/${id}?workspaceId=${this.workspaceId}`, { method: "DELETE" });
    await this.reload();
  }
}
