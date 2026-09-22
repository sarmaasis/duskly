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
        <p class="mt-1 max-w-xl text-sm text-[#63676c] dark:text-zinc-400">Totals from your own posts and publish results — not third-party social APIs.</p>
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
          <p class="font-mono text-[10px] uppercase tracking-wider text-[#92969b]">Queued</p>
          <p class="mt-1 font-mono text-3xl font-bold tracking-tight dark:text-zinc-50">{{ totals().byStatus['queued'] || 0 }}</p>
        </div>
      </div>
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
  recent = signal<{ id: string; status: string }[]>([]);

  async ngOnInit() {
    try {
      const me = await api<{ workspace: { id: string } }>("/v1/workspaces/me");
      const data = await api<{
        totals: { posts: number; published: number; byStatus: Record<string, number> };
        recent: { id: string; status: string }[];
      }>(`/v1/org/analytics?workspaceId=${me.workspace.id}`);
      this.totals.set(data.totals);
      this.recent.set(data.recent);
    } catch {
      /* unauthenticated */
    }
  }
}
