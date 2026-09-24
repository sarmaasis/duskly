import { Routes } from "@angular/router";
import { LandingPage } from "./pages/landing.page";
import { AuthPage } from "./auth/auth.page";
import { SignupPage } from "./auth/signup.page";
import { OnboardingPage } from "./auth/onboarding.page";
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
import { DocsShell } from "./docs/docs-shell";
import { DocsOverviewPage } from "./docs/docs-overview.page";
import { DocsApiPage } from "./docs/docs-api.page";
import { DocsAgentsPage } from "./docs/docs-agents.page";
import { DocsMcpPage } from "./docs/docs-mcp.page";
import { PrivacyPage, TermsPage, DataDeletionPage } from "./pages/legal.page";
import { BlogArticlePage, BlogIndexPage } from "./pages/growth.page";
import { ToolsShell } from "./pages/tools/tools-shell";
import { ToolsIndexPage } from "./pages/tools/tools-index.page";
import { CaptionCounterPage } from "./pages/tools/caption-counter.page";
import { ImageSizePage } from "./pages/tools/image-size.page";
import { PostPreviewPage } from "./pages/tools/post-preview.page";

export const routes: Routes = [
  { path: "", component: LandingPage },
  { path: "blog", component: BlogIndexPage },
  { path: "blog/:slug", component: BlogArticlePage },
  {
    path: "tools",
    component: ToolsShell,
    children: [
      { path: "", component: ToolsIndexPage },
      { path: "caption-counter", component: CaptionCounterPage },
      { path: "image-size", component: ImageSizePage },
      { path: "post-preview", component: PostPreviewPage },
    ],
  },
  { path: "free-tools", redirectTo: "tools", pathMatch: "full" },
  { path: "pricing", component: PricingPage },
  { path: "privacy", component: PrivacyPage },
  { path: "terms", component: TermsPage },
  { path: "data-deletion", component: DataDeletionPage },
  { path: "signin", component: AuthPage },
  { path: "signup", component: SignupPage },
  { path: "onboarding", component: OnboardingPage },
  { path: "invite/:id", component: InvitePage },
  {
    path: "docs",
    component: DocsShell,
    children: [
      { path: "", component: DocsOverviewPage },
      { path: "api", component: DocsApiPage },
      { path: "agents", component: DocsAgentsPage },
      { path: "mcp", component: DocsMcpPage },
    ],
  },
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
