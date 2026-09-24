import { Component, OnInit, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { api, apiBase } from "../lib/api";
import { SessionService } from "../lib/session";

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="flex min-h-dvh items-center justify-center bg-[#fbfbfa] px-4 font-sans dark:bg-zinc-950">
      <div class="w-full max-w-md rounded-xl border border-[#e8e8e3] bg-white p-8 dark:border-zinc-700 dark:bg-zinc-900">
        <a routerLink="/" class="font-display text-lg font-bold tracking-tight dark:text-zinc-100">Dus<span class="text-cta">kly</span></a>
        <h1 class="mt-6 font-display text-2xl font-extrabold dark:text-zinc-100">Join {{ workspaceName() || "this studio" }}</h1>
        @if (loading()) {
          <p class="mt-3 text-sm text-[#63676c] dark:text-zinc-400">Loading…</p>
        } @else if (error()) {
          <p class="mt-3 text-sm text-red-600">{{ error() }}</p>
        } @else if (signedIn()) {
          <p class="mt-3 text-sm text-[#63676c] dark:text-zinc-400">
            Join as <strong class="text-[#121417] dark:text-zinc-100">{{ role() }}</strong> with
            <strong class="text-[#121417] dark:text-zinc-100">{{ email() }}</strong>.
          </p>
          <button type="button" (click)="accept()" class="mt-6 inline-flex h-10 items-center rounded-md bg-cta px-4 text-sm font-semibold text-white hover:bg-cta-hover">Accept invite</button>
        } @else {
          <p class="mt-3 text-sm text-[#63676c] dark:text-zinc-400">
            Confirm <strong class="text-[#121417] dark:text-zinc-100">{{ email() }}</strong> on this page. A code is enough — you do not sign in somewhere else first.
          </p>
          @if (step() === "email") {
            <button type="button" (click)="sendCode()" class="mt-6 inline-flex h-10 items-center rounded-md bg-cta px-4 text-sm font-semibold text-white hover:bg-cta-hover">Email me a code</button>
          } @else {
            <label class="mt-6 block text-[13px] font-medium dark:text-zinc-100" for="otp">Code
              <input id="otp" maxlength="6" inputmode="numeric" autocomplete="one-time-code" [(ngModel)]="otp" class="mt-2 h-12 w-full rounded-md border border-[#e8e8e3] bg-white text-center font-display text-2xl tracking-[0.2em] outline-none focus:border-[#121417] dark:border-zinc-600 dark:bg-zinc-800" />
            </label>
            <button type="button" (click)="verify()" class="mt-4 inline-flex h-10 items-center rounded-md bg-cta px-4 text-sm font-semibold text-white hover:bg-cta-hover">Confirm and join</button>
          }
        }
        @if (msg()) {
          <p class="mt-3 text-sm" [class.text-red-600]="err()" [class.text-[#365314]]="!err()">{{ msg() }}</p>
        }
      </div>
    </div>
  `,
})
export class InvitePage implements OnInit {
  loading = signal(true);
  error = signal("");
  email = signal("");
  role = signal("member");
  workspaceName = signal("");
  signedIn = signal(false);
  step = signal<"email" | "otp">("email");
  inviteId = "";
  otp = "";
  msg = signal("");
  err = signal(false);
  private readonly route = inject(ActivatedRoute);
  private readonly session = inject(SessionService);

  async ngOnInit() {
    this.inviteId = this.route.snapshot.paramMap.get("id") || "";
    try {
      const inv = await api<{ email: string; role?: string; workspaceName: string }>(`/v1/team/invite/${this.inviteId}`);
      this.email.set(inv.email);
      this.role.set(inv.role || "member");
      this.workspaceName.set(inv.workspaceName);
      await this.session.ensure();
      const mine = (this.session.user()?.email || "").toLowerCase();
      if (mine && mine !== inv.email.toLowerCase()) {
        this.error.set(`This invite is for ${inv.email}. Sign out, then open the link again.`);
      } else {
        this.signedIn.set(mine === inv.email.toLowerCase());
      }
      this.loading.set(false);
    } catch (e: unknown) {
      this.loading.set(false);
      const err = e as { body?: { message?: string } };
      this.error.set(err.body?.message || "Invite not found or already used.");
    }
  }

  async sendCode() {
    this.err.set(false);
    const res = await fetch(`${apiBase()}/api/auth/email-otp/send-verification-otp`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: this.email(), type: "sign-in" }),
    });
    if (!res.ok) {
      this.err.set(true);
      this.msg.set("Could not send the code.");
      return;
    }
    this.step.set("otp");
    this.msg.set(`Code sent to ${this.email()}`);
  }

  async verify() {
    const res = await fetch(`${apiBase()}/api/auth/sign-in/email-otp`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: this.email(), otp: this.otp }),
    });
    if (!res.ok) {
      this.err.set(true);
      this.msg.set("That code did not work.");
      return;
    }
    await this.session.refresh();
    await this.accept();
  }

  async accept() {
    try {
      await api(`/v1/team/invite/${this.inviteId}/accept`, { method: "POST" });
      window.location.href = "/app";
    } catch (e: unknown) {
      this.err.set(true);
      const err = e as { body?: { message?: string }; message?: string };
      this.msg.set(err.body?.message || err.message || "Could not accept");
    }
  }
}
