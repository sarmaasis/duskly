import { Component, signal, OnInit } from "@angular/core";
import { api } from "../lib/api";

@Component({
  standalone: true,
  imports: [],
  template: `
    <div class="mx-auto max-w-5xl">
      <div class="mb-6">
        <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-cta">Workspace</p>
        <h1 class="mt-1 font-display text-3xl font-bold tracking-tight dark:text-zinc-50">Analytics</h1>
        <p class="mt-1 max-w-xl text-sm text-[#63676c] dark:text-zinc-400">Publish outcomes by channel, day, and status — from your own data.</p>
      </div>
      <div class="mb-6 grid gap-3 sm:grid-cols-3">
        <div class="rounded-xl border border-[#e8e8e3] bg-white p-4 shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
          <p class="font-mono text-[10px] uppercase tracking-wider text-[#92969b]">Posts</p>
          <p class="mt-1 font-mono text-3xl font-bold tracking-tight dark:text-zinc-50">{{ totals().posts }}</p>
        </div>
        <div class="rounded-xl border border-[#e8e8e3] bg-white p-4 shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
          <p class="font-mono text-[10px] uppercase tracking-wider text-[#92969b]">Published</p>
          <p class="mt-1 font-mono text-3xl font-bold tracking-tight dark:text-zinc-50">{{ totals().published }}</p>
        </div>
        <div class="rounded-xl border border-[#e8e8e3] bg-white p-4 shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
          <p class="font-mono text-[10px] uppercase tracking-wider text-[#92969b]">Queued / failed</p>
          <p class="mt-1 font-mono text-3xl font-bold tracking-tight dark:text-zinc-50">{{ (totals().byStatus['queued'] || 0) + (totals().byStatus['failed'] || 0) }}</p>
        </div>
      </div>

      <div class="mb-6 grid gap-4 lg:grid-cols-2">
        <section class="rounded-xl border border-[#e8e8e3] bg-white p-4 shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
          <p class="mb-3 font-mono text-[10px] uppercase tracking-wider text-[#92969b]">By channel</p>
          @for (entry of channelEntries(); track entry[0]) {
            <div class="mb-3">
              <p class="text-[13px] font-semibold capitalize dark:text-zinc-100">{{ entry[0] }}</p>
              <p class="font-mono text-[11px] text-[#63676c] dark:text-zinc-400">
                pub {{ entry[1]['published'] || 0 }} · queued {{ entry[1]['queued'] || 0 }} · failed {{ entry[1]['failed'] || 0 }} · pending {{ entry[1]['pending'] || 0 }}
              </p>
            </div>
          } @empty {
            <p class="text-sm text-[#63676c] dark:text-zinc-400">No destination activity yet.</p>
          }
        </section>
        <section class="rounded-xl border border-[#e8e8e3] bg-white p-4 shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
          <p class="mb-3 font-mono text-[10px] uppercase tracking-wider text-[#92969b]">By day</p>
          @for (entry of dayEntries(); track entry[0]) {
            <div class="mb-2 flex justify-between text-[13px] dark:text-zinc-200">
              <span class="font-mono text-[11px] text-[#a1a1aa]">{{ entry[0] }}</span>
              <span class="font-mono">{{ entry[1] }}</span>
            </div>
          } @empty {
            <p class="text-sm text-[#63676c] dark:text-zinc-400">No daily activity yet.</p>
          }
        </section>
      </div>

      @if (insights().length) {
        <section class="mb-6 rounded-xl border border-[#e8e8e3] bg-white p-4 shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
          <p class="mb-3 font-mono text-[10px] uppercase tracking-wider text-[#92969b]">Network insights</p>
          @for (n of insights(); track n.network) {
            <p class="mb-1 text-[12px] dark:text-zinc-300"><span class="font-semibold capitalize">{{ n.network }}</span> — {{ n.note }}</p>
          }
        </section>
      }

      <section class="rounded-xl border border-[#e8e8e3] bg-white p-4 shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
        <p class="mb-3 font-mono text-[10px] uppercase tracking-wider text-[#92969b]">Recent activity</p>
        <div class="space-y-2">
          @for (r of recent(); track r.id) {
            <div class="flex justify-between rounded-lg border border-[#e8e8e3] px-3 py-2 text-[13px] dark:border-zinc-700 dark:text-zinc-200">
              <span class="truncate pr-4">{{ r.id }}</span>
              <span class="font-mono text-[11px] text-[#a1a1aa]">{{ r.status }}</span>
            </div>
          } @empty {
            <p class="text-sm text-[#63676c] dark:text-zinc-400">No publish activity yet. Schedule a post to see results here.</p>
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
  byChannel = signal<Record<string, Record<string, number>>>({});
  byDay = signal<Record<string, number>>({});
  insights = signal<{ network: string; note: string }[]>([]);
  recent = signal<{ id: string; status: string }[]>([]);

  channelEntries = () => Object.entries(this.byChannel());
  dayEntries = () => Object.entries(this.byDay()).slice(0, 14);

  async ngOnInit() {
    try {
      const me = await api<{ workspace: { id: string } }>("/v1/workspaces/me");
      const data = await api<{
        totals: { posts: number; published: number; byStatus: Record<string, number> };
        byChannel: Record<string, Record<string, number>>;
        byDay: Record<string, number>;
        networkInsights: { network: string; note: string }[];
        recent: { id: string; status: string }[];
      }>(`/v1/org/analytics?workspaceId=${me.workspace.id}`);
      this.totals.set(data.totals);
      this.byChannel.set(data.byChannel || {});
      this.byDay.set(data.byDay || {});
      this.insights.set(data.networkInsights || []);
      this.recent.set(data.recent);
    } catch {
      /* unauthenticated */
    }
  }
}
