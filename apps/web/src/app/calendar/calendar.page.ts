import { Component, signal, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { api } from "../lib/api";
import { lsGet, lsSet } from "../lib/browser";

type Post = { id: string; body: string; status: string; scheduledAt: string | Date | null };

@Component({
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    <div class="mx-auto max-w-5xl">
      <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-cta">Schedule</p>
          <h1 class="mt-1 font-display text-3xl font-bold tracking-tight dark:text-zinc-50">Calendar</h1>
          <p class="mt-1 max-w-xl text-sm text-[#63676c] dark:text-zinc-400">Month and agenda views of your scheduled posts.</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <div class="inline-flex rounded-lg border border-[#e8e8e3] bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-900">
            <button type="button" (click)="view.set('month')" class="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors" [class.bg-[#09090b]]="view()==='month'" [class.text-white]="view()==='month'" [class.text-[#52525b]]="view()!=='month'" [class.dark:bg-zinc-100]="view()==='month'" [class.dark:text-zinc-900]="view()==='month'">Month</button>
            <button type="button" (click)="view.set('agenda')" class="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors" [class.bg-[#09090b]]="view()==='agenda'" [class.text-white]="view()==='agenda'" [class.text-[#52525b]]="view()!=='agenda'" [class.dark:bg-zinc-100]="view()==='agenda'" [class.dark:text-zinc-900]="view()==='agenda'">Agenda</button>
          </div>
          <a routerLink="/app/compose" class="inline-flex h-9 items-center rounded-full bg-cta px-4 font-mono text-xs font-semibold text-white hover:bg-cta-hover">New post</a>
        </div>
      </div>

      @if (error()) {
        <p class="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">{{ error() }}</p>
      }

      @if (view() === 'month') {
        <div class="overflow-hidden rounded-xl border border-[#e8e8e3] bg-white shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
          <div class="grid grid-cols-7 border-b border-[#e8e8e3] bg-[#f7f7f4] dark:border-zinc-700 dark:bg-zinc-800">
            @for (d of dow; track d) {
              <div class="px-2 py-2.5 text-center font-mono text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">{{ d }}</div>
            }
          </div>
          <div class="grid grid-cols-7">
            @for (cell of monthCells(); track cell.key) {
              <div class="min-h-24 border-b border-r border-[#e8e8e3] p-1.5 dark:border-zinc-800" [class.bg-[#f7f7f4]/50]="!cell.inMonth" [class.dark:bg-zinc-950]="!cell.inMonth">
                <p class="text-[11px] font-semibold dark:text-zinc-200" [class.text-[#a1a1aa]]="!cell.inMonth">{{ cell.day }}</p>
                <div class="mt-1 space-y-1">
                  @for (p of cell.posts; track p.id) {
                    <p class="truncate rounded bg-orange-50 px-1 py-0.5 text-[10px] font-medium text-cta dark:bg-orange-950/40">{{ p.body }}</p>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      } @else {
        <div class="space-y-3">
          @for (p of posts(); track p.id) {
            <article class="rounded-xl border border-[#e8e8e3] bg-white px-4 py-3 shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
              <div class="flex items-center justify-between gap-3">
                <p class="font-mono text-[11px] text-[#a1a1aa]">{{ formatWhen(p.scheduledAt) }} · {{ p.status }}</p>
                <button type="button" (click)="queueNow(p.id)" class="text-xs font-bold text-cta hover:underline">Queue now</button>
              </div>
              <p class="mt-1 text-[13px] leading-relaxed dark:text-zinc-200">{{ p.body }}</p>
            </article>
          } @empty {
            <div class="rounded-xl border border-[#e8e8e3] bg-white p-6 shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
              <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-cta">Empty calendar</p>
              <h2 class="mt-2 font-display text-lg font-semibold dark:text-zinc-100">No posts yet</h2>
              <p class="mt-2 text-sm text-[#63676c] dark:text-zinc-400">Compose a post to fill the month and agenda views.</p>
              <a routerLink="/app/compose" class="mt-4 inline-flex h-9 items-center rounded-full bg-cta px-4 text-xs font-semibold text-white hover:bg-cta-hover">Compose your first post</a>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class CalendarPage implements OnInit {
  view = signal<"month" | "agenda">("month");
  posts = signal<Post[]>([]);
  error = signal("");
  dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  monthCells = signal<{ key: string; day: number; inMonth: boolean; posts: Post[] }[]>([]);

  async ngOnInit() {
    const ws = lsGet("dk-ws");
    if (!ws) {
      try {
        const me = await api<{ workspace: { id: string } }>("/v1/workspaces/me");
        lsSet("dk-ws", me.workspace.id);
        await this.load(me.workspace.id);
      } catch {
        this.error.set("Sign in to load your calendar.");
        this.buildMonth([]);
      }
      return;
    }
    await this.load(ws);
  }

  async load(workspaceId: string) {
    try {
      const data = await api<{ posts: Post[] }>(`/v1/posts?workspaceId=${workspaceId}`);
      this.posts.set(data.posts);
      this.buildMonth(data.posts);
    } catch {
      this.error.set("Could not load posts. Is the API running?");
      this.buildMonth([]);
    }
  }

  buildMonth(list: Post[]) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const cells: { key: string; day: number; inMonth: boolean; posts: Post[] }[] = [];
    const pad = start.getDay();
    for (let i = 0; i < pad; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() - (pad - i));
      cells.push({ key: d.toISOString(), day: d.getDate(), inMonth: false, posts: [] });
    }
    for (let day = 1; day <= end.getDate(); day++) {
      const d = new Date(now.getFullYear(), now.getMonth(), day);
      const key = d.toDateString();
      const dayPosts = list.filter((p) => p.scheduledAt && new Date(p.scheduledAt).toDateString() === key);
      cells.push({ key: d.toISOString(), day, inMonth: true, posts: dayPosts });
    }
    while (cells.length % 7) {
      const last = new Date(cells[cells.length - 1].key);
      last.setDate(last.getDate() + 1);
      cells.push({ key: last.toISOString(), day: last.getDate(), inMonth: false, posts: [] });
    }
    this.monthCells.set(cells);
  }

  formatWhen(v: string | Date | null) {
    if (!v) return "unscheduled";
    return new Date(v).toLocaleString();
  }

  async queueNow(id: string) {
    await api(`/v1/posts/${id}/queue-now`, { method: "POST" });
    const ws = lsGet("dk-ws");
    if (ws) await this.load(ws);
  }
}
