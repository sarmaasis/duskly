import { Routes } from "@angular/router";
import { LandingPage } from "./pages/landing.page";
import { AuthPage } from "./auth/auth.page";
import { CalendarPage } from "./calendar/calendar.page";
import { ComposerPage } from "./composer/composer.page";
import { AccountsPage } from "./accounts/accounts.page";
import { PricingPage } from "./pages/pricing.page";
import { TeamPage } from "./team/team.page";
import { AgentPage } from "./agent/agent.page";
import { AnalyticsPage } from "./analytics/analytics.page";
import { SettingsPage } from "./settings/settings.page";
import { BillingPage } from "./billing/billing.page";
import { BillingSuccessPage } from "./billing/billing-success.page";
import { InvitePage } from "./team/invite.page";
import { AppShell } from "./layout/app-shell";

export const routes: Routes = [
  { path: "", component: LandingPage },
  { path: "pricing", component: PricingPage },
  { path: "signin", component: AuthPage },
  { path: "invite/:id", component: InvitePage },
  {
    path: "app",
    component: AppShell,
    children: [
      { path: "", component: CalendarPage },
      { path: "compose", component: ComposerPage },
      { path: "accounts", component: AccountsPage },
      { path: "team", component: TeamPage },
      { path: "agent", component: AgentPage },
      { path: "analytics", component: AnalyticsPage },
      { path: "settings", component: SettingsPage },
      { path: "billing", component: BillingPage },
      { path: "billing/success", component: BillingSuccessPage },
    ],
  },
];
