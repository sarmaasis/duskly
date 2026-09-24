import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { MarketingFooter } from "../layout/marketing-footer";
import { apiBase, nextAfterAuth } from "../lib/api";
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
            <h1 class="font-display text-[40px] font-extrabold leading-none tracking-[-0.03em]">Welcome back</h1>
            <p class="mt-3 text-[15px] leading-6 text-[#52525b]">Enter your email to receive a sign-in code.</p>
            <div class="mt-8 space-y-5">
              @if (step() === 'email') {
                <label class="block text-[13px] font-medium" for="email">Email address
                  <input id="email" type="email" autocomplete="email" placeholder="you@studio.com" [(ngModel)]="email" class="mt-2 h-10 w-full rounded-md border border-[#e8e8e3] bg-white px-3 text-sm outline-none focus:border-[#121417]" />
                </label>
                <button type="button" (click)="send()" class="inline-flex h-10 w-full items-center justify-center rounded-md bg-cta text-[14px] font-semibold text-white hover:bg-cta-hover">Send code</button>
              } @else {
                <label class="block text-[13px] font-medium" for="otp">Enter the 6-digit code
                  <input id="otp" maxlength="6" inputmode="numeric" autocomplete="one-time-code" [(ngModel)]="otp" class="mt-2 h-14 w-full rounded-md border border-[#e8e8e3] bg-white text-center font-display text-[28px] tracking-[0.24em] outline-none focus:border-[#121417]" />
                </label>
                <p class="text-[12px] text-[#a1a1aa]">Sent to {{ email }} · <button type="button" class="text-cta underline" (click)="step.set('email')">change</button></p>
                <button type="button" (click)="verify()" class="inline-flex h-10 w-full items-center justify-center rounded-md bg-cta text-[14px] font-semibold text-white hover:bg-cta-hover">Verify and continue</button>
              }
            </div>
            <p class="mt-8 text-[13px] text-[#52525b]">New here? <a routerLink="/signup" class="font-semibold text-[#09090b] underline decoration-cta decoration-2 underline-offset-4">Create an account</a></p>
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
export class AuthPage {
  email = "";
  otp = "";
  step = signal<"email" | "otp">("email");
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);
  async send() {
    await fetch(`${apiBase()}/api/auth/email-otp/send-verification-otp`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: this.email, type: "sign-in" }),
    });
    this.step.set("otp");
  }
  async verify() {
    await fetch(`${apiBase()}/api/auth/sign-in/email-otp`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: this.email, otp: this.otp }),
    });
    await this.session.refresh();
    await this.router.navigateByUrl(await nextAfterAuth());
  }
}
