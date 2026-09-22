import { Component, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <main class="shell" style="max-width:420px;padding-top:72px">
      <div class="brand" style="margin-bottom:24px">Sun<span>draft</span></div>
      <div class="card">
        <h2>Sign in with email</h2>
        <p style="color:var(--sl-muted)">We’ll send a 6-digit code.</p>
        @if (step() === 'email') {
          <div class="field"><label for="email">Email</label><input id="email" type="email" [(ngModel)]="email" /></div>
          <button class="btn btn-primary" type="button" (click)="send()">Send code</button>
        } @else {
          <div class="field"><label for="otp">Code</label><input id="otp" maxlength="6" [(ngModel)]="otp" /></div>
          <button class="btn btn-primary" type="button" (click)="verify()">Verify and continue</button>
        }
      </div>
    </main>
  `,
})
export class AuthPage {
  email = ""; otp = ""; step = signal<"email" | "otp">("email");
  constructor(private readonly router: Router) {}
  async send() {
    await fetch(`${api()}/api/auth/email-otp/send-verification-otp`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: this.email, type: "sign-in" }) });
    this.step.set("otp");
  }
  async verify() {
    await fetch(`${api()}/api/auth/sign-in/email-otp`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: this.email, otp: this.otp }) });
    await this.router.navigateByUrl("/app");
  }
}
function api() { return "http://localhost:8787"; }
