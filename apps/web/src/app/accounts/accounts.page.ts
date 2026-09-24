import { Component, computed, inject, signal, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { api, apiBase, type PlanSnapshot } from "../lib/api";
import { Notices } from "../lib/notices";
import { DkChoice, DkSelect, FIELD } from "../ui/forms";

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
  pendingPages?: { id: string; name: string }[];
  tokenExpiresAt?: number | null;
  tokenExpired?: boolean;
  lastError?: string | null;
};
type Company = { id: string; name: string; accountIds: string[] };
type SlackChannel = { id: string; name: string; isPrivate: boolean };

const FALLBACK_META: Record<string, NetMeta> = {
  linkedin: { label: "LinkedIn", group: "social", connect: "oauth" },
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
  imports: [FormsModule, DkChoice, DkSelect],
  template: `
    <div class="mx-auto max-w-6xl">
      <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-cta">Account</p>
          <h1 class="mt-1 font-display text-3xl font-bold tracking-tight dark:text-zinc-50">Accounts</h1>
          <p class="mt-1 max-w-xl text-sm text-[#63676c] dark:text-zinc-400">
            Channels you can schedule to. Group them by company when you post for clients.
          </p>
        </div>
        <div class="flex items-center gap-3">
          <div class="rounded-xl border border-[#e8e8e3] bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
            <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#92969b]">Channels</p>
            <p class="mt-0.5 font-mono text-lg font-bold tabular-nums dark:text-zinc-50">
              {{ usage()?.used?.['channels'] ?? accounts().length }}/{{ usage()?.limits?.channels ?? "—" }}
            </p>
          </div>
          <button type="button" (click)="adding.set(!adding()); if (!adding()) replaceId = ''" class="inline-flex h-10 items-center rounded-full bg-cta px-4 text-sm font-semibold text-white hover:bg-cta-hover">
            {{ adding() ? 'Close' : 'Add channel' }}
          </button>
        </div>
      </div>

      @if (msg()) {
        <p class="mb-4 rounded-xl border border-[#e8e8e3] bg-white px-4 py-3 text-[13px] shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">{{ msg() }}</p>
      }

      <details class="mb-6 rounded-xl border border-[#e8e8e3] bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <summary class="cursor-pointer font-mono text-[10px] font-semibold uppercase tracking-wider text-[#92969b]">Companies</summary>
        <p class="mt-2 text-[12px] text-[#63676c] dark:text-zinc-400">
          Each company owns its channels. Filter the board by client.
        </p>
        <form class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end" (ngSubmit)="createCompany()">
          <label class="min-w-0 flex-1 text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">New company
            <input [(ngModel)]="companyName" name="companyName" placeholder="Acme Co" [class]="'mt-1 ' + field" />
          </label>
          <button type="submit" class="inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-[#e8e8e3] bg-[#f7f7f4] px-4 text-sm font-semibold text-[#121417] hover:bg-white dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100">
            Add company
          </button>
        </form>
        <div class="flex flex-wrap gap-1.5">
          <button
            type="button"
            class="inline-flex items-center rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors"
            [class.border-[#121417]]="filterCompany()===''"
            [class.bg-[#121417]]="filterCompany()===''"
            [class.text-white]="filterCompany()===''"
            [class.border-[#e8e8e3]]="filterCompany()!==''"
            [class.bg-white]="filterCompany()!==''"
            [class.text-[#52525b]]="filterCompany()!==''"
            (click)="filterCompany.set('')"
          >All companies</button>
          <button
            type="button"
            class="inline-flex items-center rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors"
            [class.border-[#121417]]="filterCompany()==='__none__'"
            [class.bg-[#121417]]="filterCompany()==='__none__'"
            [class.text-white]="filterCompany()==='__none__'"
            [class.border-[#e8e8e3]]="filterCompany()!=='__none__'"
            [class.bg-white]="filterCompany()!=='__none__'"
            [class.text-[#52525b]]="filterCompany()!=='__none__'"
            (click)="filterCompany.set('__none__')"
          >Unassigned</button>
          @for (c of companies(); track c.id) {
            <button
              type="button"
              class="inline-flex items-center rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors"
              [class.border-[#121417]]="filterCompany()===c.id"
              [class.bg-[#121417]]="filterCompany()===c.id"
              [class.text-white]="filterCompany()===c.id"
              [class.border-[#e8e8e3]]="filterCompany()!==c.id"
              [class.bg-white]="filterCompany()!==c.id"
              [class.text-[#52525b]]="filterCompany()!==c.id"
              (click)="filterCompany.set(c.id)"
            >{{ c.name }} · {{ c.accountIds.length }}</button>
          }
        </div>
      </details>

      @if (adding()) {
      <form class="mb-6 space-y-5 rounded-xl border border-[#e8e8e3] bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900" (ngSubmit)="connect()">
        @for (g of netGroups; track g.id) {
          <div>
            <p class="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#92969b]">{{ g.label }}</p>
            <div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4" role="radiogroup" [attr.aria-label]="g.label">
              @for (n of networksIn(g.id); track n) {
                <dk-choice [value]="n" [selected]="network===n" (pick)="pickNetwork($event)">
                  <span class="flex items-center gap-2">
                    <img [src]="logoSrc(n)" [alt]="labelOf(n)" width="16" height="16" class="size-4 shrink-0 object-contain" />
                    <span>{{ labelOf(n) }}</span>
                  </span>
                </dk-choice>
              }
            </div>
          </div>
        }

        @if (companies().length) {
          <label class="block text-[11px] font-semibold text-[#71717a] dark:text-zinc-400">Assign to company
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
          <button type="submit" class="inline-flex h-10 items-center justify-center rounded-full bg-cta px-5 text-sm font-semibold text-white hover:bg-cta-hover">
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
          <button type="button" (click)="oauthConnect()" class="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-cta px-5 text-sm font-semibold text-white hover:bg-cta-hover">
            @if (network === 'slack') {
              <img src="/assets/logos/slack.svg" alt="" width="16" height="16" class="size-4 object-contain brightness-0 invert" aria-hidden="true" />
              Add to Slack
            } @else {
              {{ replaceId ? 'Replace' : 'Connect' }} with {{ labelOf(network) }} OAuth
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
                SLACK_CLIENT_ID / SLACK_CLIENT_SECRET are not set on the API — Add to Slack will return a clear config error. Posts stay queued until env is configured.
              } @else {
                API OAuth credentials for {{ labelOf(network) }} are not configured — the start endpoint returns a clear config error (no fake success). Posts stay queued until env is set.
              }
            </p>
          }
        }
      </form>
      }

      <section class="rounded-xl border border-[#e8e8e3] bg-white dark:border-zinc-700 dark:bg-zinc-900">
        <div class="flex flex-col gap-3 border-b border-[#e8e8e3] p-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-700">
          <div>
            <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#92969b]">Channel board</p>
            <p class="mt-0.5 text-[12px] text-[#63676c] dark:text-zinc-400">Search and filter the channels you can post to.</p>
          </div>
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              [ngModel]="boardQuery()"
              (ngModelChange)="boardQuery.set($event)"
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
        </div>

        <div class="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          @for (a of filteredAccounts(); track a.id) {
            <article class="flex flex-col gap-3 rounded-xl border border-[#e8e8e3] bg-[#fcfcf9] p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <div class="flex items-start gap-3">
                <img [src]="logoSrc(a.network)" [alt]="labelOf(a.network)" width="28" height="28" class="size-7 shrink-0 object-contain" />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-semibold dark:text-zinc-100">{{ a.handle }}</p>
                  <p class="text-[12px] text-[#63676c] dark:text-zinc-400">{{ labelOf(a.network) }}</p>
                </div>
                <span class="rounded-full bg-white px-2 py-0.5 font-mono text-[10px] uppercase text-[#71717a] dark:bg-zinc-800 dark:text-zinc-300">{{ a.tokenExpired ? 'expired' : a.status }}</span>
              </div>
              @if (companies().length) {
                <select
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
                  <option value="">{{ a.network === 'instagram' ? 'Pick an Instagram account…' : 'Pick a Page…' }}</option>
                  @for (p of a.pendingPages || []; track p.id) {
                    <option [value]="p.id">{{ p.name }}</option>
                  }
                </dk-select>
              }
              @if (a.tokenExpiresAt) {
                <p class="text-[11px] text-[#71717a]">Token until {{ tokenWhen(a.tokenExpiresAt) }}</p>
              }
              @if (a.lastError) {
                <p class="line-clamp-2 text-[12px] text-amber-800 dark:text-amber-200">{{ a.lastError }}</p>
              }
              @if (a.tokenExpired || a.status !== 'active') {
                <button type="button" (click)="reconnect(a)" class="self-start text-xs font-semibold text-cta">Reconnect</button>
              }
              <button type="button" (click)="remove(a.id)" class="self-start text-xs font-semibold text-red-600">Remove</button>
            </article>
          } @empty {
            <div class="col-span-full px-2 py-8 text-center">
              <p class="font-display text-lg font-semibold dark:text-zinc-100">No channels yet</p>
              <p class="mt-1 text-sm text-[#63676c] dark:text-zinc-400">Add a channel to start scheduling.</p>
              <button type="button" (click)="adding.set(true)" class="mt-4 inline-flex h-9 items-center rounded-full bg-cta px-4 text-xs font-semibold text-white">Add channel</button>
            </div>
          }
        </div>
        <p class="border-t border-[#e8e8e3] px-4 py-2 font-mono text-[10px] text-[#a1a1aa] dark:border-zinc-700">
          Showing {{ filteredAccounts().length }} of {{ accounts().length }}
        </p>
      </section>
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
  boardQuery = signal("");
  filterNetwork = signal("");
  filterCompany = signal("");
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

  constructor(private route: ActivatedRoute) {
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
    const facebook = !network || network === "facebook" || network === "instagram";
    if (reason === "not_professional") {
      return "Instagram requires a professional (Business or Creator) account — personal accounts cannot be connected.";
    }
    if (reason === "access_denied" || reason === "user_denied") {
      return facebook
        ? instagram
          ? "Instagram login was cancelled or permissions were denied."
          : "Facebook login was cancelled or permissions were denied."
        : "OAuth failed — credentials or consent rejected";
    }
    if (reason === "redirect_uri") {
      return instagram
        ? "Instagram rejected the token exchange — add the callback under Instagram → API setup with Instagram login → OAuth redirect URIs."
        : "Facebook rejected the token exchange — the redirect URI must match the authorize URL exactly.";
    }
    if (reason === "bad_secret" || reason === "missing_secret") {
      return instagram
        ? "Instagram rejected the app secret. Check INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET on the API."
        : "Facebook rejected the app secret. Check META_APP_ID and META_APP_SECRET on the API.";
    }
    if (reason === "code_used") return "Facebook authorization code was already used. Connect again from Accounts.";
    if (reason === "code_expired" || reason === "bad_code") {
      return "Facebook authorization code was invalid or expired. Connect again from Accounts.";
    }
    if (reason === "no_page") {
      return network === "instagram"
        ? "No Facebook Page with a linked Instagram professional account was found."
        : "No Facebook Pages were found on that account.";
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
      const label = instagram ? "Instagram" : "Facebook";
      return detail
        ? `${label} OAuth failed — Graph error ${code}: ${detail}`
        : `${label} OAuth failed — Graph error ${code}.`;
    }
    if (detail) {
      return instagram ? `Instagram OAuth failed — ${detail}` : `Facebook OAuth failed — ${detail}`;
    }
    if (reason && reason !== "token_failed" && reason !== "exchange" && reason !== "error") {
      return instagram ? `Instagram OAuth failed — ${reason}.` : `Facebook OAuth failed — ${reason}.`;
    }
    if (oauth === "token_failed" || reason === "token_failed" || reason === "exchange") {
      return instagram
        ? "Instagram token exchange failed. Check INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET and the Instagram Login OAuth redirect URI."
        : "Facebook token exchange failed. Check the Meta app id/secret and Valid OAuth Redirect URI.";
    }
    return "OAuth failed — credentials or consent rejected";
  }

  pickNetwork(n: string) {
    this.network = n;
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
            ? "Slack workspace connected — pick a channel on the board to finish."
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
          oauthNetwork === "instagram"
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
        await this.loadSlackChannels(accountId);
      }
    } catch {
      this.msg.set("Sign in to connect accounts.");
    }
  }

  async reload() {
    const [data, groups, me] = await Promise.all([
      api<{
        accounts: AccountRow[];
        networks: string[];
        meta?: Record<string, NetMeta>;
      }>(`/v1/accounts?workspaceId=${this.workspaceId}`),
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
        pendingPages: a.pendingPages || [],
        tokenExpiresAt: a.tokenExpiresAt ?? null,
        tokenExpired: !!a.tokenExpired,
        lastError: a.lastError ?? null,
      })),
    );
    this.networks.set(data.networks?.length ? data.networks : Object.keys(FALLBACK_META));
    if (data.meta) this.meta.set(data.meta);
    this.companies.set(
      (groups.groups || []).map((g) => ({
        id: g.id,
        name: g.name,
        accountIds: g.accountIds || [],
      })),
    );
    if (me?.usage) this.usage.set(me.usage);
  }

  tokenWhen(ms: number) {
    return new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  replaceId = "";

  reconnect(account: AccountRow) {
    this.replaceId = account.id;
    this.network = account.network;
    this.handle = account.handle;
    this.adding.set(true);
    if (this.isToken()) return;
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
    window.location.href = `${apiBase()}/v1/accounts/oauth/${this.network}/start?${q}`;
  }

  async loadSlackChannels(accountId: string) {
    if (this.slackChannels()[accountId]?.length) return;
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
      await api(`/v1/accounts/${accountId}`, {
        method: "PATCH",
        json: {
          workspaceId: this.workspaceId,
          slackChannelId: channelId,
          slackChannelName: ch?.name,
        },
      });
      this.msg.set(ch ? `Slack posts will go to #${ch.name}` : "Slack channel saved");
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
      await this.reload();
    } catch (e: unknown) {
      const err = e as { body?: { message?: string }; message?: string };
      const text = err.body?.message || err.message || "Failed";
      this.msg.set(text);
      this.notices.push("error", text);
    }
  }

  async remove(id: string) {
    await api(`/v1/accounts/${id}?workspaceId=${this.workspaceId}`, { method: "DELETE" });
    await this.reload();
  }
}
