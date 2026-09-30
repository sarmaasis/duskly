import { Component, inject, input, output } from "@angular/core";
import { Router, RouterLink, RouterLinkActive } from "@angular/router";
import { CompanyDesk } from "../lib/company-desk";

export const APP_NAV = [
  { name: "Posts", href: "/app", primary: true, description: "Drafts, scheduled posts, and delivery" },
  { name: "Accounts", href: "/app/accounts", primary: true, description: "Where you publish" },
  { name: "Analytics", href: "/app/analytics", primary: true, description: "See how publishing is going" },
  { name: "Media library", href: "/app/library", primary: false, description: "Upload and reuse photos and videos" },
  { name: "Design", href: "/app/design", primary: false, description: "Crop, text, and layers for a picture" },
  { name: "Replies", href: "/app/inbox", primary: false, description: "Read and respond to conversations" },
  { name: "AI assistant", href: "/app/agent", primary: false, description: "Get help with publishing tasks" },
  { name: "Settings", href: "/app/settings", primary: false, description: "Preferences, templates, and integrations" },
  { name: "Team", href: "/app/team", primary: false, description: "Invite people to this workspace" },
  { name: "Billing", href: "/app/billing", primary: false, description: "Manage your Cloud subscription" },
] as const;

@Component({
  selector: "dk-shell-navigation",
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  styleUrl: "./shell-navigation.css",
  template: `
    <aside class="shell-side">
      <a routerLink="/app" class="brand" aria-label="Duskly posts">Dus<span>kly</span></a>
      @if (!composing()) {
        <a routerLink="/app/compose" class="new-post">New post</a>
      }
      @if (desk.companies().length) {
        <label class="company-field">Company filter
          <select [value]="desk.selectedId()" (change)="desk.select($any($event.target).value)">
            <option value="">All companies</option>
            @for (company of desk.companies(); track company.id) { <option [value]="company.id">{{ company.name }}</option> }
          </select>
        </label>
      }
      <nav class="primary-nav" aria-label="Main navigation">
        @for (item of links(); track item.href) {
          <a [routerLink]="item.href" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: item.href === '/app' }" ariaCurrentWhenActive="page">{{ item.name }}</a>
        }
        <a routerLink="/docs">Help & documentation</a>
      </nav>
      <div class="shell-foot">
        <div class="account">
          <span class="mark" aria-hidden="true">{{ initial() }}</span>
          <p class="workspace" [attr.title]="workspace()">{{ workspace() }}</p>
        </div>
        <div class="foot-tools">
          <button type="button" (click)="review.emit()" aria-haspopup="dialog" aria-label="Delivery updates">
            Delivery
            @if (alertCount() || alertsError()) { <span>{{ alertsError() ? '!' : alertCount() }}</span> }
          </button>
          <button type="button" (click)="themeChange.emit()" [attr.aria-label]="'Theme: ' + theme()">{{ theme() === 'dark' ? 'Dark' : 'Light' }}</button>
          <button type="button" (click)="logout.emit()">Sign out</button>
        </div>
      </div>
    </aside>
  `,
})
export class ShellNavigation {
  readonly cloud = input(false);
  readonly workspace = input("");
  readonly theme = input<"light" | "dark">("light");
  readonly alertCount = input(0);
  readonly alertsError = input(false);
  readonly review = output<void>();
  readonly themeChange = output<void>();
  readonly logout = output<void>();
  readonly desk = inject(CompanyDesk);
  private readonly router = inject(Router);
  composing() { return this.router.url.split(/[?#]/)[0] === '/app/compose'; }
  initial() {
    const name = this.workspace().trim();
    return (name[0] || "A").toUpperCase();
  }
  links() { return APP_NAV.filter((item) => item.href !== '/app/billing' || this.cloud()); }
}
