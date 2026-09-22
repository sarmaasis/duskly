import { Component, signal, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AppShell } from "../layout/app-shell";
import { api } from "../lib/api";

@Component({
  standalone: true,
  imports: [AppShell, FormsModule],
  template: `
    <dk-shell>
      <div class="mb-5">
        <p class="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa]">Schedule</p>
        <p class="mt-1 text-[13px] text-[#63676c]">Describe a post. The agent drafts copy, picks a time, and schedules it on a connected channel.</p>
      </div>
      <textarea [(ngModel)]="prompt" rows="4" class="w-full rounded-xl border border-[#e8e8e3] bg-white px-4 py-3 text-sm outline-none focus:border-[#121417]" placeholder="Announce our Friday drop…"></textarea>
      <button type="button" (click)="run()" class="mt-3 inline-flex h-10 items-center rounded-md bg-cta px-4 text-sm font-semibold text-white hover:bg-cta-hover">Run agent</button>
      @if (result()) {
        <pre class="mt-4 overflow-auto rounded-xl border border-[#e8e8e3] bg-[#f7f7f4] p-4 font-mono text-xs">{{ result() }}</pre>
      }
      <div class="mt-8 space-y-2">
        @for (r of runs(); track r.id) {
          <article class="rounded-xl border border-[#e8e8e3] bg-white px-4 py-3 text-[13px]">
            <p class="font-mono text-[11px] text-[#a1a1aa]">{{ r.status }} · {{ r.id }}</p>
            <p class="mt-1">{{ r.prompt }}</p>
          </article>
        }
      </div>
    </dk-shell>
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
