import { Component, signal, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { api, type PlanSnapshot } from "../lib/api";
import { labelStatus } from "../lib/labels";
import { Spinner } from "../ui/spinner";

@Component({
  standalone: true,
  imports: [FormsModule, Spinner],
  template: `
    <div class="mx-auto max-w-5xl">
      <div class="mb-6">
        <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-cta">Account</p>
        <h1 class="mt-1 font-display text-3xl font-bold tracking-tight text-ink dark:text-zinc-50">Team</h1>
        <p class="mt-1 max-w-xl text-sm text-muted dark:text-zinc-400">Invite members on Team plan and above. Standard is solo.</p>
      </div>

      @if (msg()) {
        <p class="mb-4 rounded-xl border border-[#e8e8e3] bg-white px-4 py-3 text-[13px] shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900" [class.text-red-600]="err()">{{ msg() }}</p>
      }

      <form class="mb-6 flex flex-wrap gap-2 rounded-xl border border-[#e8e8e3] bg-white p-4 shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900" (ngSubmit)="invite()">
        <input [(ngModel)]="email" name="email" type="email" required placeholder="teammate@studio.com" class="h-10 min-w-[14rem] flex-1 rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm outline-none transition-colors focus:border-[#121417] focus:bg-white dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" />
        <select [(ngModel)]="role" name="role" class="h-10 rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-3 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100">
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" [disabled]="inviting()" [attr.aria-busy]="inviting()" class="inline-flex h-10 items-center gap-2 rounded-full bg-cta px-5 text-sm font-semibold text-white hover:bg-cta-hover disabled:opacity-70">
          @if (inviting()) { <dk-spinner /> }
          Invite
        </button>
      </form>

      @if (loading()) {
        <div class="mb-8 flex justify-center text-cta"><dk-spinner [size]="20" label="Loading" [block]="true" /></div>
      }
      <div class="mb-8 space-y-3">
        <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">Members</p>
        @for (m of members(); track m.userId) {
          <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e8e8e3] bg-white px-4 py-3 text-[13px] shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
            <span>{{ m.name || m.email }} · {{ labelStatus(m.role) }}</span>
            <div class="flex items-center gap-3">
              @if (m.role === 'member') {
                <label class="text-[11px] font-semibold text-[#71717a]">Company
                  <select class="ml-2 h-9 rounded-md border border-[#e8e8e3] bg-[#f7f7f4] px-2 text-sm dark:border-zinc-600 dark:bg-zinc-800" [ngModel]="m.groupId || ''" (ngModelChange)="setCompany(m.userId, $event)" [name]="'company-' + m.userId">
                    <option value="">All companies</option>
                    @for (company of companies(); track company.id) {
                      <option [value]="company.id">{{ company.name }}</option>
                    }
                  </select>
                </label>
              }
              <button type="button" (click)="remove(m.userId)" class="text-xs font-semibold text-red-600">Remove</button>
            </div>
          </div>
        } @empty {
          <p class="text-[13px] text-[#63676c] dark:text-zinc-400">No members loaded yet.</p>
        }
      </div>
      <div class="space-y-3">
        <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">Pending invites</p>
        @for (i of invites(); track i.id) {
          <div class="flex justify-between rounded-xl border border-[#e8e8e3] bg-white px-4 py-3 text-[13px] shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
            <span>{{ i.email }} · {{ labelStatus(i.role || "member") }}</span>
            <button type="button" (click)="revoke(i.id)" class="text-xs font-semibold text-red-600">Revoke</button>
          </div>
        } @empty {
          <div class="rounded-xl border border-[#e8e8e3] bg-white p-6 shadow-[0_1px_3px_rgba(15,18,24,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
            <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-cta">No invites</p>
            <h2 class="mt-2 font-display text-lg font-semibold dark:text-zinc-100">Invite a teammate</h2>
            <p class="mt-2 text-sm text-[#63676c] dark:text-zinc-400">They open the emailed link and confirm that address with a code on the same page.</p>
          </div>
        }
      </div>
    </div>
  `,
})
export class TeamPage implements OnInit {
  readonly labelStatus = labelStatus;
  members = signal<{ userId: string; role: string; email?: string; name?: string; groupId?: string | null }[]>([]);
  companies = signal<{ id: string; name: string }[]>([]);
  invites = signal<{ id: string; email: string; role?: string }[]>([]);
  email = "";
  role: "member" | "admin" = "member";
  workspaceId = "";
  msg = signal("");
  err = signal(false);
  loading = signal(true);
  inviting = signal(false);
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
    } finally {
      this.loading.set(false);
    }
  }

  async reload() {
    const [data, groups] = await Promise.all([
      api<{
        members: { userId: string; role: string; email?: string; name?: string; groupId?: string | null }[];
        invites: { id: string; email: string; role?: string }[];
      }>(`/v1/team?workspaceId=${this.workspaceId}`),
      api<{ groups: { id: string; name: string }[] }>(`/v1/org/groups?workspaceId=${this.workspaceId}`).catch(() => ({ groups: [] })),
    ]);
    this.members.set(data.members);
    this.invites.set(data.invites);
    this.companies.set(groups.groups || []);
  }

  async setCompany(userId: string, groupId: string) {
    await api(`/v1/team/member/${userId}`, {
      method: "PATCH",
      json: { workspaceId: this.workspaceId, groupId: groupId || null },
    });
    await this.reload();
  }

  async invite() {
    if (this.inviting()) return;
    this.inviting.set(true);
    try {
      await api("/v1/team/invite", {
        method: "POST",
        json: { workspaceId: this.workspaceId, email: this.email, role: this.role },
      });
      this.email = "";
      this.err.set(false);
      this.msg.set("Invite emailed — they join from that link");
      await this.reload();
    } catch (e: unknown) {
      this.err.set(true);
      const err = e as { body?: { message?: string }; message?: string };
      this.msg.set(err.body?.message || err.message || "Invite blocked");
    } finally {
      this.inviting.set(false);
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
