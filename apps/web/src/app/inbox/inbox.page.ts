import { Component, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { api } from "../lib/api";

type Item = { id: string; network: string; handle: string; text: string; accountId: string };

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="mx-auto max-w-3xl">
      <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-cta">Schedule</p>
      <h1 class="mt-1 font-display text-3xl font-bold tracking-tight dark:text-zinc-50">Inbox</h1>
      <p class="mt-1 text-sm text-[#63676c] dark:text-zinc-400">Comments and mentions from channels that return them. The bell stays for publish problems.</p>
      @if (error()) {
        <p class="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900" role="alert">{{ error() }}</p>
      }
      <div class="mt-6 space-y-3">
        @for (item of items(); track item.id) {
          <article class="rounded-xl border border-[#e8e8e3] bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <p class="inline-flex items-center gap-1.5 text-[12px] font-semibold">
              <img [src]="'/assets/logos/' + item.network + '.svg'" alt="" width="14" height="14" class="size-3.5 object-contain" />
              {{ item.network }} · {{ item.handle }}
            </p>
            <p class="mt-2 text-sm dark:text-zinc-100">{{ item.text }}</p>
            <form class="mt-3 flex gap-2" (ngSubmit)="reply(item)">
              <input [(ngModel)]="drafts[item.id]" [name]="item.id" placeholder="Reply" class="h-9 min-w-0 flex-1 rounded-lg border border-[#e8e8e3] px-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
              <button type="submit" class="h-9 rounded-full bg-cta px-3 text-xs font-semibold text-white">Send</button>
            </form>
          </article>
        } @empty {
          <p class="rounded-xl border border-[#e8e8e3] bg-white p-6 text-sm text-[#63676c] dark:border-zinc-700 dark:bg-zinc-900">No comments came back from the connected channels.</p>
        }
      </div>
    </div>
  `,
})
export class InboxPage implements OnInit {
  items = signal<Item[]>([]);
  error = signal("");
  drafts: Record<string, string> = {};
  private workspaceId = "";

  async ngOnInit() {
    try {
      const me = await api<{ workspace: { id: string } }>("/v1/workspaces/me");
      this.workspaceId = me.workspace.id;
      const data = await api<{ items: Item[] }>(`/v1/inbox?workspaceId=${me.workspace.id}`);
      this.items.set(data.items || []);
    } catch {
      this.error.set("Sign in to read comments.");
    }
  }

  async reply(item: Item) {
    const text = (this.drafts[item.id] || "").trim();
    if (!text) return;
    try {
      await api("/v1/inbox/reply", {
        method: "POST",
        json: { workspaceId: this.workspaceId, accountId: item.accountId, commentId: item.id, network: item.network, text },
      });
      this.drafts[item.id] = "";
    } catch {
      this.error.set("The reply was not accepted.");
    }
  }
}
