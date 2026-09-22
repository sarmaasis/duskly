import { Component, signal, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { api, type PlanSnapshot } from "../lib/api";

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="mx-auto max-w-5xl">
      <div class="mb-6">
        <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-cta">Workspace</p>
        <h1 class="mt-1 font-display text-3xl font-bold tracking-tight dark:text-zinc-50">Team</h1>
        <p class="mt-1 max-w-xl text-sm text-[#63676c] dark:text-zinc-400">Invite members on Team plan and above. Standard is solo.</p>
      </div>

      @if (msg()) {
        <p class="mb-4 rounded-xl border border-[#e8e8e3] bg-white px-4 py-3 text-[13px] shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900" [class.text-red-600]="err()">{{ msg() }}</p>
      }

      <form class="mb-6 flex flex-wrap gap-2 rounded-xl border border-[#e8e8e3] bg-white p-4 shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900" (ngSubmit)="invite()">
        <input [(ngModel)]="email" name="email" type="email" required placeholder="teammate@studio.com" class="h-10 min-w-[14rem] flex-1 rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm outline-none focus:border-[#121417] focus:bg-white dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" />
        <button type="submit" class="h-10 rounded-full bg-cta px-5 text-xs font-semibold text-white hover:bg-cta-hover">Invite</button>
      </form>

      <div class="mb-8 space-y-3">
        <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">Members</p>
        @for (m of members(); track m.userId) {
          <div class="flex justify-between rounded-xl border border-[#e8e8e3] bg-white px-4 py-3 text-[13px] shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
            <span>{{ m.name || m.email }} · {{ m.role }}</span>
            <button type="button" (click)="remove(m.userId)" class="text-xs font-semibold text-red-600">Remove</button>
          </div>
        } @empty {
          <p class="text-[13px] text-[#63676c] dark:text-zinc-400">No members loaded yet.</p>
        }
      </div>
      <div class="space-y-3">
        <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">Pending invites</p>
        @for (i of invites(); track i.id) {
          <div class="flex justify-between rounded-xl border border-[#e8e8e3] bg-white px-4 py-3 text-[13px] shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
            <span>{{ i.email }}</span>
            <button type="button" (click)="revoke(i.id)" class="text-xs font-semibold text-red-600">Revoke</button>
          </div>
        } @empty {
          <div class="rounded-xl border border-[#e8e8e3] bg-white p-6 shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
            <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-cta">No invites</p>
            <h2 class="mt-2 font-display text-lg font-semibold dark:text-zinc-100">Invite a teammate</h2>
            <p class="mt-2 text-sm text-[#63676c] dark:text-zinc-400">They accept via the emailed link while signed in as that address.</p>
          </div>
        }
      </div>
    </div>
  `,
})
export class TeamPage implements OnInit {
  members = signal<{ userId: string; role: string; email?: string; name?: string }[]>([]);
  invites = signal<{ id: string; email: string }[]>([]);
  email = "";
  workspaceId = "";
  msg = signal("");
  err = signal(false);
  usage = signal<PlanSnapshot | null>(null);

  async ngOnInit() {
    try {
      const me = await api<{ workspace: { id: string }; usage: PlanSnapshot }>("/v1/workspaces/me");
      this.workspaceId = me.workspace.id;
      this.usage.set(me.usage);
      await this.reload();
    } catch {
      this.err.set(true);
      this.msg.set("Sign in to manage team.");
    }
  }

  async reload() {
    const data = await api<{
      members: { userId: string; role: string; email?: string; name?: string }[];
      invites: { id: string; email: string }[];
    }>(`/v1/team?workspaceId=${this.workspaceId}`);
    this.members.set(data.members);
    this.invites.set(data.invites);
  }

  async invite() {
    try {
      await api("/v1/team/invite", {
        method: "POST",
        json: { workspaceId: this.workspaceId, email: this.email },
      });
      this.email = "";
      this.err.set(false);
      this.msg.set("Invite emailed — they accept via the link while signed in as that address");
      await this.reload();
    } catch (e: unknown) {
      this.err.set(true);
      const err = e as { body?: { message?: string }; message?: string };
      this.msg.set(err.body?.message || err.message || "Invite blocked");
    }
  }

  async remove(userId: string) {
    await api(`/v1/team/member/${userId}?workspaceId=${this.workspaceId}`, { method: "DELETE" });
    await this.reload();
  }

  async revoke(id: string) {
    await api(`/v1/team/invite/${id}?workspaceId=${this.workspaceId}`, { method: "DELETE" });
    await this.reload();
  }
}
