import { Component, signal, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { api } from "../lib/api";

type ChannelStat = { network: string; handle: string; published: number; queued: number; failed: number; pending: number };
type RecentChannel = { network: string; handle: string; status: string; error: string | null };
type Recent = { id: string; body: string; status: string; at: number | null; channels: RecentChannel[] };

const LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  x: "X",
  instagram: "Instagram",
  threads: "Threads",
  facebook: "Facebook",
  youtube: "YouTube",
  reddit: "Reddit",
  bluesky: "Bluesky",
  mastodon: "Mastodon",
  hashnode: "Hashnode",
  devto: "dev.to",
  telegram: "Telegram",
  discord: "Discord",
  slack: "Slack",
};

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="mx-auto max-w-5xl">
      <div class="mb-6">
        <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-cta">Account</p>
        <h1 class="mt-1 font-display text-3xl font-bold tracking-tight dark:text-zinc-50">Analytics</h1>
        <p class="mt-1 max-w-xl text-sm text-[#63676c] dark:text-zinc-400">What went out, what is still waiting, and which channel it was for.</p>
      </div>

      <form class="mb-4 flex flex-wrap items-end gap-2" (ngSubmit)="load()">
        <label class="text-[11px] font-medium text-[#71717a]">From
          <input type="date" name="from" [value]="from" (input)="from = $any($event.target).value" class="mt-1 block h-9 rounded-lg border border-[#e8e8e3] bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
        </label>
        <label class="text-[11px] font-medium text-[#71717a]">To
          <input type="date" name="to" [value]="to" (input)="to = $any($event.target).value" class="mt-1 block h-9 rounded-lg border border-[#e8e8e3] bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
        </label>
        <button type="submit" class="h-9 rounded-full bg-cta px-3 text-xs font-semibold text-white">Apply</button>
      </form>
      <p class="mb-4 text-[12px] text-[#71717a]">Counts are publish outcomes. Likes, comments, and reach stay off until a network returns them for this app.</p>

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
          <p class="mb-3 font-mono text-[10px] uppercase tracking-wider text-[#92969b]">Sends by day</p>
          @for (day of days(); track day.day) {
            <div class="mb-2">
              <div class="mb-1 flex justify-between text-[12px] dark:text-zinc-200">
                <span>{{ formatDay(day.day) }}</span>
                <span class="font-mono text-[#71717a]">{{ day.count }}</span>
              </div>
              <div class="h-1.5 overflow-hidden rounded-full bg-[#f7f7f4] dark:bg-zinc-800">
                <div class="h-full rounded-full bg-cta" [style.width.%]="day.pct"></div>
              </div>
            </div>
          } @empty {
            <p class="text-sm text-[#63676c] dark:text-zinc-400">No daily activity yet.</p>
          }
        </section>
      </div>

      <section class="rounded-xl border border-[#e8e8e3] bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <p class="mb-3 font-mono text-[10px] uppercase tracking-wider text-[#92969b]">Recent posts</p>
        <div class="space-y-2">
          @for (r of recent(); track r.id) {
            <article class="rounded-lg border border-[#e8e8e3] px-3 py-2.5 dark:border-zinc-700">
              <div class="flex items-start justify-between gap-3">
                <p class="line-clamp-2 text-[13px] leading-snug dark:text-zinc-100">{{ r.body.trim() || 'No caption' }}</p>
                <span class="shrink-0 rounded-full bg-[#f7f7f4] px-2 py-0.5 font-mono text-[10px] uppercase text-[#63676c] dark:bg-zinc-800 dark:text-zinc-300">{{ statusLabel(r.status) }}</span>
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
                <p class="mt-1 text-[12px] text-amber-800 dark:text-amber-200">{{ label(ch.network) }}: {{ ch.error || statusLabel(ch.status) }}</p>
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
  totals = signal<{ posts: number; published: number; byStatus: Record<string, number> }>({
    posts: 0,
    published: 0,
    byStatus: {},
  });
  channels = signal<ChannelStat[]>([]);
  days = signal<{ day: string; count: number; pct: number }[]>([]);
  recent = signal<Recent[]>([]);
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
      }>(`/v1/org/analytics?${q}`);
      this.totals.set(data.totals);
      this.channels.set(data.channels || []);
      this.days.set(this.dayBars(data.byDay || {}));
      this.recent.set(data.recent || []);
    } catch {
      this.error.set("Could not load analytics.");
    }
  }

  label(network: string) {
    return LABELS[network] || network;
  }

  statusLabel(status: string) {
    const words: Record<string, string> = {
      published: "Published",
      queued: "Queued",
      failed: "Failed",
      draft: "Draft",
      scheduled: "Scheduled",
      pending: "Waiting",
    };
    return words[status] || status;
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

  formatDay(iso: string) {
    const [year, month, day] = iso.split("-").map(Number);
    if (!year || !month || !day) return iso;
    return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }

  formatWhen(at: number | null) {
    if (!at) return "No time";
    return new Date(at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  private dayBars(byDay: Record<string, number>) {
    const entries = Object.entries(byDay).slice(0, 14);
    const max = Math.max(1, ...entries.map(([, count]) => count));
    return entries.map(([day, count]) => ({ day, count, pct: Math.round((count / max) * 100) }));
  }
}
