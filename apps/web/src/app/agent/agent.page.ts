import { Component, signal, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { api } from "../lib/api";

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="mx-auto max-w-5xl">
      <div class="mb-6">
        <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-cta">Schedule</p>
        <h1 class="mt-1 font-display text-3xl font-bold tracking-tight dark:text-zinc-50">Smart agent</h1>
        <p class="mt-1 max-w-xl text-sm text-[#63676c] dark:text-zinc-400">Describe a post. The agent drafts copy, picks a time, and schedules it on a connected channel.</p>
      </div>

      <section class="rounded-xl border border-[#e8e8e3] bg-white p-4 shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
        <p class="mb-3 font-mono text-[10px] uppercase tracking-wider text-[#92969b] dark:text-zinc-500">Prompt</p>
        <textarea [(ngModel)]="prompt" rows="4" class="w-full rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 py-2 text-sm outline-none transition-colors focus:border-[#121417] focus:bg-white dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" placeholder="Announce our Friday drop…"></textarea>
        <button type="button" (click)="run()" class="mt-3 inline-flex h-10 items-center rounded-full bg-cta px-5 text-sm font-semibold text-white hover:bg-cta-hover">Run agent</button>
      </section>

      @if (result()) {
        <pre class="mt-4 overflow-auto rounded-xl border border-[#e8e8e3] bg-[#f7f7f4] p-4 font-mono text-xs shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">{{ result() }}</pre>
      }

      <div class="mt-8 space-y-3">
        <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">Recent runs</p>
        @for (r of runs(); track r.id) {
          <article class="rounded-xl border border-[#e8e8e3] bg-white px-4 py-3 text-[13px] shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
            <p class="font-mono text-[11px] text-[#a1a1aa]">{{ r.status }} · {{ r.id }}</p>
            <p class="mt-1 dark:text-zinc-200">{{ r.prompt }}</p>
          </article>
        } @empty {
          <div class="rounded-xl border border-[#e8e8e3] bg-white p-6 shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
            <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-cta">No runs</p>
            <h2 class="mt-2 font-display text-lg font-semibold dark:text-zinc-100">Run the agent once</h2>
            <p class="mt-2 text-sm text-[#63676c] dark:text-zinc-400">Past prompts and statuses will show up here.</p>
          </div>
        }
      </div>
    </div>
  `,
})
export class AgentPage implements OnInit {
  prompt = "";
  workspaceId = "";
  result = signal("");
  runs = signal<{ id: string; prompt: string; status: string }[]>([]);

  async ngOnInit() {
    try {
      const me = await api<{ workspace: { id: string } }>("/v1/workspaces/me");
      this.workspaceId = me.workspace.id;
      const data = await api<{ runs: { id: string; prompt: string; status: string }[] }>(
        `/v1/ai/agent?workspaceId=${this.workspaceId}`,
      );
      this.runs.set(data.runs);
    } catch {
      /* unauthenticated */
    }
  }

  async run() {
    const r = await api<Record<string, unknown>>("/v1/ai/agent", {
      method: "POST",
      json: { workspaceId: this.workspaceId, prompt: this.prompt, scheduleInMinutes: 60 },
    });
    this.result.set(JSON.stringify(r, null, 2));
    const data = await api<{ runs: { id: string; prompt: string; status: string }[] }>(
      `/v1/ai/agent?workspaceId=${this.workspaceId}`,
    );
    this.runs.set(data.runs);
  }
}
