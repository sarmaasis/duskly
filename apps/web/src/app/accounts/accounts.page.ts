import { Component } from "@angular/core";
import { AppShell } from "../layout/app-shell";
@Component({
  standalone: true,
  imports: [AppShell],
  template: `<sd-shell>
    <h1>Accounts</h1>
    <div class="card">
      <p style="color:var(--sl-muted)">Connect a network. Tokens stay encrypted in D1.</p>
      <button class="btn btn-primary" type="button">Connect Bluesky</button>
    </div>
  </sd-shell>`,
})
export class AccountsPage {}
