import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";
@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <header class="shell topbar">
      <div class="brand">Sun<span>draft</span></div>
      <nav>
        <a routerLink="/signin" class="btn btn-ghost">Sign in</a>
        <a routerLink="/signin" class="btn btn-primary">Start scheduling</a>
      </nav>
    </header>
    <main class="shell hero">
      <div>
        <h1>Queue the post. Hit publish at dusk.</h1>
        <p>Open-source scheduler on two Cloudflare Workers. Email OTP. No password store.</p>
        <a routerLink="/signin" class="btn btn-primary">Start scheduling</a>
      </div>
      <div class="card"><strong>Today</strong><p style="color:var(--sl-muted)">3 scheduled · next at 18:05</p></div>
    </main>
  `,
})
export class LandingPage {}
