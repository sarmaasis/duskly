import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { COMPOSE } from "./compose-context";

type Bucket = { id: string; name: string; accounts: { id: string; network: string; handle: string; avatarUrl?: string | null }[] };

@Component({
  selector: "dk-compose-channels",
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <section class="rounded-2xl border border-[#e8e8e3] bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      @if (!c.accountsForCompany().length) {
        <p class="rounded-xl border border-[#e8e8e3] bg-[#fcfcf9] p-4 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
          Connect an account in <a routerLink="/app/accounts" class="font-semibold text-cta underline">Accounts</a>.
        </p>
      } @else {
        @if (grouped()) {
          <label class="mb-3 block text-sm font-semibold text-[#121417] dark:text-zinc-100">Find an account
            <input [ngModel]="query()" (ngModelChange)="query.set($event)" name="accountSearch" placeholder="Search by name" class="mt-1.5 h-10 w-full rounded-xl border border-[#e8e8e3] bg-[#fcfcf9] px-3 text-sm font-normal dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" />
          </label>
        }
        <div class="flex flex-wrap gap-3">
          @for (a of visible(); track a.id) {
            <button type="button" (click)="c.toggle(a.id)" [attr.aria-pressed]="c.selected().includes(a.id)" [attr.aria-label]="c.networkLabel(a.network) + ' ' + a.handle" [title]="c.networkLabel(a.network) + ' · ' + a.handle" class="relative size-12 shrink-0">
              <span class="flex size-full items-center justify-center overflow-hidden rounded-full border-2 text-sm font-bold text-cta" [class.border-cta]="c.selected().includes(a.id)" [class.bg-cta-soft]="!a.avatarUrl || c.selected().includes(a.id)" [class.border-[#e8e8e3]]="!c.selected().includes(a.id)" [class.bg-white]="!!a.avatarUrl && !c.selected().includes(a.id)">
                @if (a.avatarUrl) { <img [src]="a.avatarUrl" alt="" class="size-full object-cover" /> } @else { <img [src]="'/assets/logos/' + a.network + '.svg'" alt="" width="22" height="22" class="dk-net-badge size-6 object-contain" /> }
              </span>
              @if (a.avatarUrl) {
                <span class="absolute -right-1 -top-1 z-10 flex size-5 items-center justify-center rounded-full bg-white shadow-sm ring-2 ring-white dark:ring-zinc-900">
                  <img [src]="'/assets/logos/' + a.network + '.svg'" alt="" width="14" height="14" class="dk-net-badge size-3.5 object-contain" />
                </span>
              }
            </button>
          }
        </div>
        @for (a of c.selectedAccounts(); track a.id) {
          @if (a.network === 'slack' && !a.slackChannelId) {
            <label class="mt-3 block text-xs font-semibold text-[#121417] dark:text-zinc-100">Slack channel for {{ a.handle }}
              <select
                [attr.aria-label]="'Slack channel for ' + a.handle"
                class="mt-1.5 h-10 w-full rounded-xl border border-[#e8e8e3] bg-[#fcfcf9] px-3 text-sm font-normal dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                [ngModel]="a.slackChannelId || ''"
                (ngModelChange)="c.pickSlackChannel(a.id, $event)"
                (focus)="c.loadSlackChannels(a.id)"
                [name]="'slack-compose-' + a.id"
              >
                <option value="">Pick a channel…</option>
                @for (ch of c.slackChannels()[a.id] || []; track ch.id) {
                  <option [value]="ch.id">#{{ ch.name }}</option>
                }
              </select>
            </label>
            @if (c.slackChannels()[a.id] && !c.slackChannels()[a.id].length) {
              <p class="mt-2 text-xs text-[#63676c] dark:text-zinc-400">Reconnect Slack from Accounts and choose a channel there. This connection cannot list channels yet.</p>
            }
          }
        }
        @if (grouped() && query().trim() && !visible().length) {
          <p class="mt-2 text-sm text-zinc-500">No accounts match that search.</p>
        }
      }
    </section>
  `,
})
export class ComposeChannels {
  readonly c = inject(COMPOSE);
  readonly query = signal("");
  readonly showAll = signal<Record<string, boolean>>({});
  readonly preview = 8;

  readonly grouped = computed(() => this.c.accountsForCompany().length > 8 || this.c.groups().length > 3);

  readonly buckets = computed((): Bucket[] => {
    const q = this.query().trim().toLowerCase();
    const matched = this.c.accountsForCompany().filter((account) => {
      if (!q) return true;
      return account.handle.toLowerCase().includes(q) || this.c.networkLabel(account.network).toLowerCase().includes(q);
    });
    const groups = this.c.groups();
    const buckets: Bucket[] = groups
      .map((group) => ({
        id: group.id,
        name: group.name,
        accounts: matched.filter((account) => group.accountIds.includes(account.id)),
      }))
      .filter((bucket) => bucket.accounts.length);
    const assigned = new Set(groups.flatMap((group) => group.accountIds));
    const loose = matched.filter((account) => !assigned.has(account.id));
    if (loose.length) buckets.push({ id: "__none__", name: "Not in a company", accounts: loose });
    if (!buckets.length && matched.length) buckets.push({ id: "all", name: "Accounts", accounts: matched });
    return buckets;
  });

  visible() {
    if (!this.grouped()) return this.c.accountsForCompany();
    if (!this.query().trim()) return [];
    return this.buckets().flatMap((bucket) => bucket.accounts);
  }

  hiddenCount() {
    if (!this.grouped() || this.query().trim() || this.showAll()["all"]) return 0;
    return Math.max(0, this.buckets().flatMap((bucket) => bucket.accounts).length - 24);
  }

  revealAll() {
    this.showAll.update((current) => ({ ...current, all: true }));
  }

  shown(bucket: Bucket) {
    if (this.query().trim() || this.showAll()[bucket.id]) return bucket.accounts;
    return bucket.accounts.slice(0, this.preview);
  }

  ids(bucket: Bucket) {
    return bucket.accounts.map((account) => account.id);
  }

  reveal(id: string) {
    this.showAll.update((current) => ({ ...current, [id]: true }));
  }
}
