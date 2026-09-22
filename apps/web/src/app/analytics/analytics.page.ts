import { Component, signal, OnInit } from "@angular/core";
import { AppShell } from "../layout/app-shell";
import { api } from "../lib/api";

@Component({
  standalone: true,
  imports: [AppShell],
  template: `
    <dk-shell>
      <div class="mb-5">
        <p class="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa]">Workspace</p>
        <p class="mt-1 text-[13px] text-[#63676c]">Totals from your own posts and publish results — not third-party social APIs.</p>
      </div>
      <div class="mb-6 grid gap-3 sm:grid-cols-3">
        <div class="rounded-xl border border-[#e8e8e3] bg-white p-4">
          <p class="font-mono text-[10px] uppercase tracking-wider text-[#92969b]">Posts</p>
          <p class="mt-1 font-mono text-3xl font-bold tracking-tight">{{ totals().posts }}</p>
        </div>
        <div class="rounded-xl border border-[#e8e8e3] bg-white p-4">
          <p class="font-mono text-[10px] uppercase tracking-wider text-[#92969b]">Published</p>
          <p class="mt-1 font-mono text-3xl font-bold tracking-tight">{{ totals().published }}</p>
        </div>
        <div class="rounded-xl border border-[#e8e8e3] bg-white p-4">
          <p class="font-mono text-[10px] uppercase tracking-wider text-[#92969b]">Queued</p>
          <p class="mt-1 font-mono text-3xl font-bold tracking-tight">{{ totals().byStatus['queued'] || 0 }}</p>
        </div>
      </div>
      <div class="space-y-2">
        @for (r of recent(); track r.id) {
          <div class="flex justify-between rounded-xl border border-[#e8e8e3] bg-white px-4 py-3 text-[13px]">
            <span class="truncate pr-4">{{ r.id }}</span>
            <span class="font-mono text-[11px] text-[#a1a1aa]">{{ r.status }}</span>
          </div>
        }
      </div>
    </dk-shell>
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
