import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";
import { AppShell } from "../layout/app-shell";
@Component({
  standalone: true,
  imports: [AppShell, RouterLink],
  template: `<sd-shell>
    <header style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
      <h1 style="margin:0">Calendar</h1>
      <a routerLink="/app/compose" class="btn btn-primary">New post</a>
    </header>
    <div class="card"><p style="color:var(--sl-muted)">No posts this week.</p></div>
  </sd-shell>`,
})
export class CalendarPage {}
