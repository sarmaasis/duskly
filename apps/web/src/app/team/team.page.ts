import { Component, signal, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AppShell } from "../layout/app-shell";
import { api, type PlanSnapshot } from "../lib/api";

@Component({
  standalone: true,
  imports: [AppShell, FormsModule],
  template: `
    <dk-shell>
      <div class="mb-5">
        <p class="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa]">Workspace</p>
        <p class="mt-1 text-[13px] text-[#63676c]">Invite members on Team plan and above. Standard is solo.</p>
      </div>

      @if (msg()) {
        <p class="mb-4 rounded-xl border border-[#e8e8e3] bg-white px-4 py-3 text-[13px]" [class.text-red-600]="err()">{{ msg() }}</p>
      }

      <form class="mb-6 flex flex-wrap gap-2 rounded-xl border border-[#e8e8e3] bg-white p-4" (ngSubmit)="invite()">
        <input [(ngModel)]="email" name="email" type="email" required placeholder="teammate@studio.com" class="h-10 min-w-[14rem] flex-1 rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm outline-none focus:border-[#121417] focus:bg-white" />
        <button type="submit" class="h-10 rounded-md bg-cta px-4 text-xs font-semibold text-white hover:bg-cta-hover">Invite</button>
      </form>

      <div class="mb-8 space-y-2">
        <p class="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa]">Members</p>
        @for (m of members(); track m.userId) {
          <div class="flex justify-between rounded-xl border border-[#e8e8e3] bg-white px-4 py-3 text-[13px]">
            <span>{{ m.name || m.email }} · {{ m.role }}</span>
            <button type="button" (click)="remove(m.userId)" class="text-xs font-semibold text-red-600">Remove</button>
          </div>
        }
      </div>
      <div class="space-y-2">
        <p class="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa]">Pending invites</p>
        @for (i of invites(); track i.id) {
          <div class="flex justify-between rounded-xl border border-[#e8e8e3] bg-white px-4 py-3 text-[13px]">
            <span>{{ i.email }}</span>
            <button type="button" (click)="revoke(i.id)" class="text-xs font-semibold text-red-600">Revoke</button>
          </div>
        }
      </div>
    </dk-shell>
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
    const me = await api<{ workspace: { id: string }; usage: PlanSnapshot }>("/v1/workspaces/me");
    this.workspaceId = me.workspace.id;
    this.usage.set(me.usage);
    await this.reload();
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
      this.msg.set("Invite created");
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
