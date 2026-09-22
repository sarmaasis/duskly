import { Component, OnInit, signal } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { api } from "../lib/api";

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="flex min-h-dvh items-center justify-center bg-[#fbfbfa] px-4 font-sans dark:bg-zinc-950">
      <div class="w-full max-w-md rounded-xl border border-[#e8e8e3] bg-white p-8 dark:border-zinc-700 dark:bg-zinc-900">
        <a routerLink="/" class="font-display text-lg font-bold tracking-tight dark:text-zinc-100">Dus<span class="text-cta">kly</span></a>
        <h1 class="mt-6 font-display text-2xl font-extrabold dark:text-zinc-100">Team invite</h1>
        @if (loading()) {
          <p class="mt-3 text-sm text-[#63676c] dark:text-zinc-400">Loading…</p>
        } @else if (error()) {
          <p class="mt-3 text-sm text-red-600">{{ error() }}</p>
          <a routerLink="/signin" class="mt-4 inline-flex text-sm font-semibold text-cta">Sign in</a>
        } @else {
          <p class="mt-3 text-sm text-[#63676c] dark:text-zinc-400">
            Join <strong class="text-[#121417] dark:text-zinc-100">{{ workspaceName() }}</strong> as
            <strong class="text-[#121417] dark:text-zinc-100">{{ email() }}</strong>.
          </p>
          <button type="button" (click)="accept()" class="mt-6 inline-flex h-10 items-center rounded-md bg-cta px-4 text-sm font-semibold text-white hover:bg-cta-hover">
            Accept invite
          </button>
          @if (msg()) {
            <p class="mt-3 text-sm" [class.text-red-600]="err()" [class.text-[#365314]]="!err()">{{ msg() }}</p>
          }
        }
      </div>
    </div>
  `,
})
export class InvitePage implements OnInit {
  loading = signal(true);
  error = signal("");
  email = signal("");
  workspaceName = signal("");
  inviteId = "";
  msg = signal("");
  err = signal(false);

  constructor(private route: ActivatedRoute) {}

  async ngOnInit() {
    this.inviteId = this.route.snapshot.paramMap.get("id") || "";
    try {
      const inv = await api<{ email: string; workspaceName: string }>(`/v1/team/invite/${this.inviteId}`);
      this.email.set(inv.email);
      this.workspaceName.set(inv.workspaceName);
      this.loading.set(false);
    } catch (e: unknown) {
      this.loading.set(false);
      const err = e as { status?: number; body?: { message?: string } };
      if (err.status === 401) this.error.set("Sign in with the invited email, then reopen this link.");
      else this.error.set(err.body?.message || "Invite not found or already used.");
    }
  }

  async accept() {
    try {
      await api(`/v1/team/invite/${this.inviteId}/accept`, { method: "POST" });
      this.err.set(false);
      this.msg.set("Joined — open the app to continue.");
      window.location.href = "/app";
    } catch (e: unknown) {
      this.err.set(true);
      const err = e as { body?: { message?: string }; message?: string };
      this.msg.set(err.body?.message || err.message || "Could not accept");
    }
  }
}
