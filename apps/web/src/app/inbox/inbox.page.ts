import { Component, effect, inject, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { api } from "../lib/api";
import { CompanyDesk } from "../lib/company-desk";
import { labelNetwork } from "../lib/labels";
import { Spinner } from "../ui/spinner";
import { ScrollMore } from "../ui/scroll-more";

type Item = { id: string; network: string; handle: string; text: string; accountId: string };

@Component({
  standalone: true,
  imports: [FormsModule, Spinner, ScrollMore],
  template: `
    <div class="mx-auto max-w-3xl">
      <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-cta">Publishing</p>
      <h1 class="mt-1 font-display text-3xl font-bold tracking-tight text-ink dark:text-zinc-50">Replies</h1>
      <p class="mt-1 max-w-xl text-sm text-muted dark:text-zinc-400">Comments and mentions from supported accounts. Publishing status is in Delivery updates.</p>
      @if (error()) {
        <p class="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900" role="alert">{{ error() }}</p>
      }
      <div class="mt-6 space-y-3">
        @for (item of shown(); track item.id) {
          <article class="rounded-xl border border-[#e8e8e3] bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <p class="inline-flex items-center gap-1.5 text-[12px] font-semibold">
              <img [src]="'/assets/logos/' + item.network + '.svg'" alt="" width="14" height="14" class="size-3.5 object-contain" />
              {{ labelNetwork(item.network) }} · {{ item.handle }}
            </p>
            <p class="mt-2 text-sm dark:text-zinc-100">{{ item.text }}</p>
            <form class="mt-3 flex gap-2" (ngSubmit)="reply(item)">
              <input [(ngModel)]="drafts[item.id]" [name]="item.id" placeholder="Reply" class="h-9 min-w-0 flex-1 rounded-lg border border-[#e8e8e3] px-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
              <button type="submit" [disabled]="sending() === item.id" [attr.aria-busy]="sending() === item.id" class="inline-flex h-10 items-center gap-2 rounded-full bg-cta px-4 text-sm font-semibold text-white hover:bg-cta-hover disabled:opacity-70">
                @if (sending() === item.id) { <dk-spinner /> }
                Send
              </button>
            </form>
          </article>
        } @empty {
          @if (loading()) {
            <div class="flex justify-center text-cta"><dk-spinner [size]="20" label="Loading" [block]="true" /></div>
          } @else {
            <p class="rounded-xl border border-[#e8e8e3] bg-white p-6 text-sm text-[#63676c] dark:border-zinc-700 dark:bg-zinc-900">{{ desk.current() ? 'No comments for ' + desk.current()!.name + '.' : 'No comments came back from the connected channels.' }}</p>
          }
        }
      </div>
      <div class="flex h-10 items-center justify-center" dkScrollMore [dkScrollEnabled]="next() != null" [dkScrollBusy]="paging()" (dkScrollMoreFire)="more()">
        @if (paging()) { <dk-spinner [size]="16" label="Loading more" /> }
      </div>
    </div>
  `,
})
export class InboxPage implements OnInit {
  readonly labelNetwork = labelNetwork;
  readonly desk = inject(CompanyDesk);
  items = signal<Item[]>([]);
  next = signal<number | null>(null);
  paging = signal(false);
  error = signal("");
  loading = signal(true);
  sending = signal("");
  drafts: Record<string, string> = {};
  private workspaceId = "";

  constructor() {
    effect(() => {
      this.desk.selectedId();
      if (!this.workspaceId) return;
      this.items.set([]);
      this.next.set(null);
      void this.more();
    });
  }

  async ngOnInit() {
    try {
      const me = await api<{ workspace: { id: string } }>("/v1/workspaces/me");
      this.workspaceId = me.workspace.id;
      await this.more();
    } catch {
      this.error.set("Sign in to read comments.");
    } finally {
      this.loading.set(false);
    }
  }

  shown() {
    return this.items().filter((item) => this.desk.allowsAccount(item.accountId));
  }

  async more() {
    if (this.paging()) return;
    const offset = this.next() ?? 0;
    if (this.next() == null && this.items().length) return;
    this.paging.set(true);
    this.loading.set(true);
    try {
      const data = await api<{ items: Item[]; next: number | null }>(`/v1/inbox?${this.desk.scopeQuery(this.workspaceId)}&offset=${offset}`);
      this.items.update((rows) => (offset === 0 ? data.items || [] : rows.concat(data.items || [])));
      this.next.set(typeof data.next === "number" ? data.next : null);
    } finally {
      this.paging.set(false);
      this.loading.set(false);
    }
  }

  async reply(item: Item) {
    const text = (this.drafts[item.id] || "").trim();
    if (!text || this.sending()) return;
    this.sending.set(item.id);
    try {
      await api("/v1/inbox/reply", {
        method: "POST",
        json: { workspaceId: this.workspaceId, accountId: item.accountId, commentId: item.id, network: item.network, text },
      });
      this.drafts[item.id] = "";
    } catch {
      this.error.set("The reply was not accepted.");
    } finally {
      this.sending.set("");
    }
  }
}
