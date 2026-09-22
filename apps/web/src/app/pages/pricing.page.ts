import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";
@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <header class="shell topbar">
      <a routerLink="/" class="brand">Cue<span>ora</span></a>
    </header>
    <main class="shell" style="padding:48px 24px;display:grid;gap:24px;grid-template-columns:1fr 1fr">
      <div class="card">
        <h2>Self-host</h2>
        <p style="color:var(--sl-muted)">Apache-2.0. Your Workers, your D1. Billing stays off.</p>
        <a href="https://github.com/sarmaasis/sundraft" class="btn btn-ghost">Clone the repo</a>
      </div>
      <div class="card">
        <h2>Cueora Cloud</h2>
        <p style="color:var(--sl-muted)">We run it. You pay via Dodo. Cancel anytime.</p>
        <a routerLink="/signin" class="btn btn-primary">Start with Pro</a>
      </div>
    </main>
  `,
})
export class PricingPage {}
