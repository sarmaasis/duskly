import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";
@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <header class="shell topbar">
      <div class="brand">Cue<span>ora</span></div>
      <nav>
        <a routerLink="/pricing" class="btn btn-ghost">Pricing</a>
        <a routerLink="/signin" class="btn btn-ghost">Sign in</a>
        <a routerLink="/signin" class="btn btn-primary">Start scheduling</a>
      </nav>
    </header>
    <main class="shell hero">
      <div>
        <h1>Cue the post. Publish on time.</h1>
        <p>Open-source scheduler. Self-host it, or use Cueora Cloud and pay via Dodo.</p>
        <a routerLink="/signin" class="btn btn-primary">Start scheduling</a>
      </div>
      <div class="card">
        <strong>Today</strong>
        <p style="color:var(--sl-muted);margin:8px 0 0">3 scheduled · 1 draft · next at 18:05</p>
      </div>
    </main>
  `,
})
export class LandingPage {}
