import { Component, OnInit, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { api } from "../lib/api";

type Item = { id: string; kind: string; previewUrl: string; bytes: number };

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="mx-auto max-w-5xl">
      <div class="mb-6 flex items-end justify-between gap-3">
        <div>
          <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-cta">Schedule</p>
          <h1 class="mt-1 font-display text-3xl font-bold tracking-tight dark:text-zinc-50">Library</h1>
          <p class="mt-1 text-sm text-[#63676c] dark:text-zinc-400">Pictures and videos already uploaded. Attach them from Compose.</p>
        </div>
        <a routerLink="/app/compose" class="inline-flex h-9 items-center rounded-full bg-cta px-4 text-xs font-semibold text-white">Compose</a>
      </div>
      @if (error()) {
        <p class="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900" role="alert">{{ error() }}</p>
      }
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        @for (item of items(); track item.id) {
          <figure class="overflow-hidden rounded-xl border border-[#e8e8e3] bg-white dark:border-zinc-700 dark:bg-zinc-900">
            @if (item.kind === 'video') {
              <div class="flex h-36 items-center justify-center bg-[#f7f7f4] text-[11px] font-semibold text-[#71717a] dark:bg-zinc-800">Video</div>
            } @else {
              <img [src]="item.previewUrl" alt="" class="h-36 w-full object-cover" />
            }
            <figcaption class="flex items-center justify-between px-2 py-1.5">
              <span class="font-mono text-[10px] text-[#a1a1aa]">{{ item.kind }}</span>
              <a [routerLink]="['/app/compose']" [queryParams]="{ media: item.id }" class="text-[11px] font-semibold text-cta">Use</a>
            </figcaption>
          </figure>
        } @empty {
          <p class="col-span-full text-sm text-[#63676c] dark:text-zinc-400">Nothing uploaded yet.</p>
        }
      </div>
      @if (next() != null) {
        <button type="button" (click)="more()" class="mt-4 h-9 rounded-full border border-[#e8e8e3] px-4 text-xs font-semibold dark:border-zinc-700">More</button>
      }
    </div>
  `,
})
export class MediaPage implements OnInit {
  items = signal<Item[]>([]);
  next = signal<number | null>(null);
  error = signal("");
  private workspaceId = "";

  async ngOnInit() {
    try {
      const me = await api<{ workspace: { id: string } }>("/v1/workspaces/me");
      this.workspaceId = me.workspace.id;
      await this.more();
    } catch {
      this.error.set("Could not load the library.");
    }
  }

  async more() {
    const offset = this.next() ?? 0;
    const data = await api<{ media: Item[]; next: number | null }>(`/v1/media?workspaceId=${this.workspaceId}&offset=${offset}`);
    this.items.update((rows) => rows.concat(data.media || []));
    this.next.set(data.next);
  }
}
