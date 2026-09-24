import { Component, signal, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { api } from "../lib/api";
import { labelNetwork, labelStatus } from "../lib/labels";
import { DkDate } from "../ui/forms";

type ChannelStat = { network: string; handle: string; published: number; queued: number; failed: number; pending: number };
type RecentChannel = { network: string; handle: string; status: string; error: string | null };
type Recent = { id: string; body: string; status: string; at: number | null; channels: RecentChannel[] };

@Component({
  standalone: true,
  imports: [FormsModule, DkDate],
  template: `
    <div class="mx-auto max-w-5xl">
      <div class="mb-6">
        <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-cta">Account</p>
        <h1 class="mt-1 font-display text-3xl font-bold tracking-tight dark:text-zinc-50">Analytics</h1>
        <p class="mt-1 max-w-xl text-sm text-[#63676c] dark:text-zinc-400">What went out, what is still waiting, and which channel it was for.</p>
      </div>

      <form class="mb-4 flex flex-wrap items-end gap-2" (ngSubmit)="load()">
        <label class="w-40 text-[11px] font-medium text-[#71717a]">From
          <div class="mt-1"><dk-date name="from" [(ngModel)]="from" placeholder="Start" /></div>
        </label>
        <label class="w-40 text-[11px] font-medium text-[#71717a]">To
          <div class="mt-1"><dk-date name="to" [(ngModel)]="to" placeholder="End" /></div>
        </label>
        <button type="submit" class="h-10 rounded-full bg-cta px-3 text-xs font-semibold text-white">Apply</button>
      </form>
      <p class="mb-4 text-[12px] text-[#71717a]">Likes, comments, and reach show only when X, Instagram, or Facebook returns a number.</p>
      @if (engagement().length) {
        <div class="mb-6 grid gap-3 sm:grid-cols-2">
          @for (row of engagement(); track row.network + row.handle + (row.likes ?? '') + (row.comments ?? '')) {
            <div class="rounded-xl border border-[#e8e8e3] bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
              <p class="text-sm font-semibold dark:text-zinc-100">{{ label(row.network) }} · {{ row.handle }}</p>
              <p class="mt-1 text-[12px] text-[#71717a]">
                @if (row.likes != null) { <span>{{ row.likes }} likes</span> }
                @if (row.comments != null) { <span> · {{ row.comments }} comments</span> }
                @if (row.reach != null) { <span> · {{ row.reach }} reach</span> }
              </p>
            </div>
          }
        </div>
      }

      @if (error()) {
        <p class="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100" role="alert">{{ error() }}</p>
      }

      <div class="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-xl border border-[#e8e8e3] bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <p class="font-mono text-[10px] uppercase tracking-wider text-[#92969b]">Posts</p>
          <p class="mt-1 font-mono text-3xl font-bold tracking-tight dark:text-zinc-50">{{ totals().posts }}</p>
          @if (totals().byStatus['draft'] || totals().byStatus['scheduled']) {
            <p class="mt-1 text-[11px] text-[#71717a]">{{ totals().byStatus['draft'] || 0 }} drafts · {{ totals().byStatus['scheduled'] || 0 }} scheduled</p>
          }
        </div>
        <div class="rounded-xl border border-[#e8e8e3] bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <p class="font-mono text-[10px] uppercase tracking-wider text-[#92969b]">Published</p>
          <p class="mt-1 font-mono text-3xl font-bold tracking-tight dark:text-zinc-50">{{ totals().published }}</p>
        </div>
        <div class="rounded-xl border border-[#e8e8e3] bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <p class="font-mono text-[10px] uppercase tracking-wider text-[#92969b]">Queued</p>
          <p class="mt-1 font-mono text-3xl font-bold tracking-tight dark:text-zinc-50">{{ totals().byStatus['queued'] || 0 }}</p>
        </div>
        <div class="rounded-xl border border-[#e8e8e3] bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <p class="font-mono text-[10px] uppercase tracking-wider text-[#92969b]">Failed</p>
          <p class="mt-1 font-mono text-3xl font-bold tracking-tight dark:text-zinc-50">{{ totals().byStatus['failed'] || 0 }}</p>
        </div>
      </div>

      <div class="mb-6 grid gap-4 lg:grid-cols-2">
        <section class="rounded-xl border border-[#e8e8e3] bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <p class="mb-3 font-mono text-[10px] uppercase tracking-wider text-[#92969b]">By channel</p>
          @for (ch of channels(); track ch.network + ch.handle) {
            <div class="mb-3 flex items-start gap-2">
              <img [src]="'/assets/logos/' + ch.network + '.svg'" [alt]="label(ch.network)" width="16" height="16" class="mt-0.5 size-4 shrink-0 object-contain" />
              <div class="min-w-0">
                <p class="truncate text-[13px] font-semibold dark:text-zinc-100">{{ label(ch.network) }} · {{ ch.handle }}</p>
                <p class="text-[12px] text-[#63676c] dark:text-zinc-400">{{ channelLine(ch) }}</p>
              </div>
            </div>
          } @empty {
            <p class="text-sm text-[#63676c] dark:text-zinc-400">No channel activity yet.</p>
          }
        </section>
        <section class="rounded-xl border border-[#e8e8e3] bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <p class="mb-3 font-mono text-[10px] uppercase tracking-wider text-[#92969b]">{{ monthLabel() }}</p>
          <div class="mb-1 grid grid-cols-7 gap-1 text-center font-mono text-[9px] font-semibold uppercase text-[#a1a1aa]">
            @for (d of dow; track d) { <span>{{ d }}</span> }
          </div>
          <div class="grid grid-cols-7 gap-1">
            @for (cell of monthCells(); track cell.key) {
              <div
                class="flex h-8 items-center justify-center rounded-md text-[12px] font-semibold"
                [class.text-transparent]="!cell.day"
                [class.bg-cta]="cell.count > 0"
                [class.text-white]="cell.count > 0"
                [class.text-[#121417]]="!!cell.day && !cell.count"
                [class.dark:text-zinc-100]="!!cell.day && !cell.count"
                [attr.title]="cell.count ? cell.count + ' sends' : null"
              >{{ cell.day || '' }}</div>
            }
          </div>
        </section>
      </div>

      <section class="rounded-xl border border-[#e8e8e3] bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <p class="mb-3 font-mono text-[10px] uppercase tracking-wider text-[#92969b]">Recent posts</p>
        <div class="space-y-2">
          @for (r of recent(); track r.id) {
            <article class="rounded-lg border border-[#e8e8e3] px-3 py-2.5 dark:border-zinc-700">
              <div class="flex items-start justify-between gap-3">
                <p class="line-clamp-2 text-[13px] leading-snug dark:text-zinc-100">{{ r.body.trim() || 'No caption' }}</p>
                <span class="shrink-0 rounded-full bg-[#f7f7f4] px-2 py-0.5 text-[10px] font-semibold text-[#63676c] dark:bg-zinc-800 dark:text-zinc-300">{{ labelStatus(r.status) }}</span>
              </div>
              <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                @for (ch of r.channels; track ch.network + ch.handle) {
                  <span class="inline-flex items-center gap-1 text-[11px] text-[#63676c] dark:text-zinc-400">
                    <img [src]="'/assets/logos/' + ch.network + '.svg'" alt="" width="12" height="12" class="size-3 object-contain" />
                    {{ ch.handle }}
                  </span>
                }
                <span class="text-[11px] text-[#a1a1aa]">{{ formatWhen(r.at) }}</span>
              </div>
              @for (ch of problems(r); track ch.network + ch.handle) {
                <p class="mt-1 text-[12px] text-amber-800 dark:text-amber-200">{{ labelNetwork(ch.network) }}: {{ ch.error || labelStatus(ch.status) }}</p>
              }
            </article>
          } @empty {
            <p class="text-sm text-[#63676c] dark:text-zinc-400">No posts yet. Schedule one and it will show up here with its caption and channel.</p>
          }
        </div>
      </section>
    </div>
  `,
})
export class AnalyticsPage implements OnInit {
  readonly labelStatus = labelStatus;
  readonly label = labelNetwork;
  readonly labelNetwork = labelNetwork;
  totals = signal<{ posts: number; published: number; byStatus: Record<string, number> }>({
    posts: 0,
    published: 0,
    byStatus: {},
  });
  channels = signal<ChannelStat[]>([]);
  days = signal<{ day: string; count: number }[]>([]);
  readonly dow = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  recent = signal<Recent[]>([]);
  engagement = signal<{ network: string; handle: string; likes?: number; comments?: number; reach?: number }[]>([]);
  error = signal("");
  from = "";
  to = "";
  private workspaceId = "";

  async ngOnInit() {
    await this.load();
  }

  async load() {
    try {
      this.error.set("");
      if (!this.workspaceId) {
        const me = await api<{ workspace: { id: string } }>("/v1/workspaces/me");
        this.workspaceId = me.workspace.id;
      }
      const tz = new Date().getTimezoneOffset();
      const q = new URLSearchParams({ workspaceId: this.workspaceId, tz: String(tz) });
      if (this.from) q.set("from", this.from);
      if (this.to) q.set("to", this.to);
      const data = await api<{
        totals: { posts: number; published: number; byStatus: Record<string, number> };
        byDay: Record<string, number>;
        channels: ChannelStat[];
        recent: Recent[];
        engagement?: { network: string; handle: string; likes?: number; comments?: number; reach?: number }[];
      }>(`/v1/org/analytics?${q}`);
      this.totals.set(data.totals);
      this.channels.set(data.channels || []);
      this.days.set(Object.entries(data.byDay || {}).map(([day, count]) => ({ day, count })));
      this.recent.set(data.recent || []);
      this.engagement.set(data.engagement || []);
    } catch {
      this.error.set("Could not load analytics.");
    }
  }

  channelLine(ch: ChannelStat) {
    const parts: string[] = [];
    if (ch.published) parts.push(`${ch.published} published`);
    if (ch.queued) parts.push(`${ch.queued} queued`);
    if (ch.failed) parts.push(`${ch.failed} failed`);
    if (ch.pending) parts.push(`${ch.pending} waiting`);
    return parts.join(" · ") || "No sends yet";
  }

  problems(post: Recent) {
    return post.channels.filter((ch) => ch.error);
  }

  formatWhen(at: number | null) {
    if (!at) return "No time";
    return new Date(at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  monthLabel() {
    const anchor = this.from || this.days()[0]?.day || new Date().toISOString().slice(0, 10);
    const [y, m] = anchor.split("-").map(Number);
    return new Date(y || 2026, (m || 1) - 1, 1).toLocaleString("en", { month: "long", year: "numeric" });
  }

  monthCells() {
    const anchor = this.from || this.days()[0]?.day || new Date().toISOString().slice(0, 10);
    const [y, m] = anchor.split("-").map(Number);
    const year = y || new Date().getFullYear();
    const month = (m || new Date().getMonth() + 1) - 1;
    const counts = new Map(this.days().map((d) => [d.day, d.count]));
    const first = new Date(year, month, 1).getDay();
    const total = new Date(year, month + 1, 0).getDate();
    const cells: { key: string; day: number; count: number }[] = [];
    for (let i = 0; i < first; i++) cells.push({ key: `p${i}`, day: 0, count: 0 });
    for (let day = 1; day <= total; day++) {
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      cells.push({ key: iso, day, count: counts.get(iso) || 0 });
    }
    return cells;
  }
}
