import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { MarketingFooter } from "../layout/marketing-footer";
import { nextAfterAuth } from "../lib/api";
import { SessionService } from "../lib/session";

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, MarketingFooter],
  template: `
    <div class="flex min-h-dvh flex-col bg-[#fbfbfa] font-sans text-[#09090b] antialiased">
      <div class="flex flex-1">
      <div class="flex flex-1 flex-col px-6 py-8 sm:px-10 lg:px-16">
        <a routerLink="/" class="font-display text-[17px] font-extrabold tracking-tight">Dus<span class="text-cta">kly</span></a>
        <div class="flex flex-1 items-center py-10">
          <div class="mx-auto w-full max-w-[400px]">
            <h1 class="font-display text-[40px] font-extrabold leading-none tracking-[-0.03em]">Create your account</h1>
            <p class="mt-3 text-[15px] leading-6 text-[#52525b]">Enter your name and email to receive a sign-up code.</p>
            <div class="mt-8 space-y-5">
              @if (step() === 'email') {
                <label class="block text-[13px] font-medium" for="name">Name
                  <input id="name" type="text" autocomplete="name" placeholder="Alex Rivera" [(ngModel)]="name" class="mt-2 h-10 w-full rounded-md border border-[#e8e8e3] bg-white px-3 text-sm outline-none focus:border-[#121417]" />
                </label>
                <label class="block text-[13px] font-medium" for="email">Email address
                  <input id="email" type="email" autocomplete="email" placeholder="you@studio.com" [(ngModel)]="email" class="mt-2 h-10 w-full rounded-md border border-[#e8e8e3] bg-white px-3 text-sm outline-none focus:border-[#121417]" />
                </label>
                <button type="button" (click)="send()" [disabled]="busy()" class="inline-flex h-10 w-full items-center justify-center rounded-md bg-cta text-[14px] font-semibold text-white hover:bg-cta-hover disabled:opacity-60">Send code</button>
              } @else {
                <label class="block text-[13px] font-medium" for="otp">Enter the 6-digit code
                  <input id="otp" maxlength="6" inputmode="numeric" autocomplete="one-time-code" [(ngModel)]="otp" class="mt-2 h-14 w-full rounded-md border border-[#e8e8e3] bg-white text-center font-display text-[28px] tracking-[0.24em] outline-none focus:border-[#121417]" />
                </label>
                <p class="text-[12px] text-[#a1a1aa]">Sent to {{ email }} · <button type="button" class="text-cta underline" (click)="step.set('email'); error.set('')">change</button></p>
                <button type="button" (click)="verify()" [disabled]="busy()" class="inline-flex h-10 w-full items-center justify-center rounded-md bg-cta text-[14px] font-semibold text-white hover:bg-cta-hover disabled:opacity-60">Verify and continue</button>
              }
              @if (error()) {
                <p class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700" role="alert">{{ error() }}</p>
              }
            </div>
            <p class="mt-8 text-[13px] text-[#52525b]">Already have an account? <a routerLink="/signin" class="font-semibold text-[#09090b] underline decoration-cta decoration-2 underline-offset-4">Sign in</a></p>
          </div>
        </div>
      </div>
      <aside class="hidden flex-1 items-center justify-center border-l border-[#e8e8e3] bg-white px-12 lg:flex" aria-hidden="true">
        <div class="w-full max-w-sm">
          <p class="mb-8 font-mono text-[11px] font-semibold uppercase tracking-widest text-cta">Social scheduling desk</p>
          <div class="mb-8">
            <div class="mb-1 h-px w-8 bg-cta"></div>
            <p class="text-[15px] font-semibold">Self-host for free</p>
            <p class="mt-1 text-[13px] leading-5 text-[#52525b]">Open source on your Cloudflare account.</p>
          </div>
          <div class="mb-8">
            <div class="mb-1 h-px w-8 bg-cta"></div>
            <p class="text-[15px] font-semibold">Or use Duskly Cloud</p>
            <p class="mt-1 text-[13px] leading-5 text-[#52525b]">Managed SaaS at duskly.site from $29/mo.</p>
          </div>
          <div class="mb-8">
            <div class="mb-1 h-px w-8 bg-cta"></div>
            <p class="text-[15px] font-semibold">Email OTP auth</p>
            <p class="mt-1 text-[13px] leading-5 text-[#52525b]">No password store on the worker.</p>
          </div>
          <p class="mt-4 text-[12px] text-[#a1a1aa]">Cloud billing by Dodo Payments.</p>
        </div>
      </aside>
      </div>
      <dk-marketing-footer />
    </div>
  `,
})
export class SignupPage {
  name = "";
  email = "";
  otp = "";
  step = signal<"email" | "otp">("email");
  error = signal("");
  busy = signal(false);
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);
  async send() {
    this.error.set("");
    if (!this.email.trim()) {
      this.error.set("Enter your email address.");
      return;
    }
    this.busy.set(true);
    try {
      const res = await fetch(`${api()}/api/auth/email-otp/send-verification-otp`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: this.email.trim(), type: "sign-in" }),
      });
      if (!res.ok) {
        this.error.set(await readError(res));
        return;
      }
      this.step.set("otp");
    } catch {
      this.error.set("Could not reach the auth server. Is the API running?");
    } finally {
      this.busy.set(false);
    }
  }
  async verify() {
    this.error.set("");
    if (!this.otp.trim()) {
      this.error.set("Enter the 6-digit code.");
      return;
    }
    this.busy.set(true);
    try {
      const body: { email: string; otp: string; name?: string } = {
        email: this.email.trim(),
        otp: this.otp.trim(),
      };
      const name = this.name.trim();
      if (name) body.name = name;
      const res = await fetch(`${api()}/api/auth/sign-in/email-otp`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        this.error.set(await readError(res));
        return;
      }
      await this.session.refresh();
      await this.router.navigateByUrl(await nextAfterAuth());
    } catch {
      this.error.set("Could not reach the auth server. Is the API running?");
    } finally {
      this.busy.set(false);
    }
  }
}
function api() {
  return "http://localhost:8787";
}
async function readError(res: Response) {
  try {
    const data = (await res.json()) as { message?: string; error?: string };
    return data.message || data.error || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}
