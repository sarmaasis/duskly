import { Component } from "@angular/core";
import { RouterLink, RouterLinkActive } from "@angular/router";
@Component({
  selector: "sd-shell",
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <div class="app-grid">
      <aside class="side">
        <div class="brand" style="margin-bottom:24px">Sun<span>draft</span></div>
        <a routerLink="/app" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}">Calendar</a>
        <a routerLink="/app/compose" routerLinkActive="active">Compose</a>
        <a routerLink="/app/accounts" routerLinkActive="active">Accounts</a>
      </aside>
      <section style="padding:24px"><ng-content /></section>
    </div>
  `,
})
export class AppShell {}
