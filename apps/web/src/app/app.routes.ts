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

export const routes: Routes = [
  { path: "", component: LandingPage },
  { path: "pricing", component: PricingPage },
  { path: "signin", component: AuthPage },
  { path: "app", component: CalendarPage },
  { path: "app/compose", component: ComposerPage },
  { path: "app/accounts", component: AccountsPage },
  { path: "app/team", component: TeamPage },
  { path: "app/agent", component: AgentPage },
  { path: "app/analytics", component: AnalyticsPage },
  { path: "app/settings", component: SettingsPage },
];
