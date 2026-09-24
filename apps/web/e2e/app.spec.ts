import { expect, test } from "@playwright/test";
import { expectReady, mockApi } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test("public marketing, docs, legal, pricing, and blog routes render", async ({ page }) => {
  const routes: Array<[string, string | RegExp]> = [
    ["/", /Schedule posts/i],
    ["/pricing", /Pricing/i],
    ["/privacy", /Privacy/i],
    ["/terms", /Terms/i],
    ["/data-deletion", /Data deletion/i],
    ["/docs", /Docs|Overview/i],
    ["/docs/api", /API/i],
    ["/docs/agents", /agent/i],
    ["/docs/mcp", /MCP/i],
    ["/tools", /Free tools|tools/i],
    ["/blog", /Blog|Growth/i],
  ];
  for (const [path, text] of routes) {
    await page.goto(path);
    await expectReady(page, text);
  }
});

test("free tools update locally without an account", async ({ page }) => {
  await page.goto("/tools/caption-counter");
  await page.getByLabel("Caption").fill("Launch day #duskly");
  await expect(page.getByText("18").first()).toBeVisible();
  await expect(page.getByText("1").first()).toBeVisible();

  await page.goto("/tools/post-preview");
  await page.getByLabel("Caption").fill("Preview this post");
  await expect(page.getByText("Preview this post").last()).toBeVisible();

  await page.goto("/tools/image-size");
  await expectReady(page, /Image size check/i);
});

test("email OTP sign in moves from code request to the app shell", async ({ page }) => {
  await page.goto("/signin");
  await page.getByLabel("Email address").fill("owner@example.com");
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByLabel("Enter the 6-digit code")).toBeVisible();
  await page.getByLabel("Enter the 6-digit code").fill("123456");
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expectReady(page, "Calendar");
});

test("app shell navigation, alerts, and core authenticated pages render", async ({ page }) => {
  await page.goto("/app");
  await expectReady(page, "Launch notes are live");

  await page.getByRole("button", { name: "Notifications" }).first().click();
  await expectReady(page, "Needs attention");

  const pages: Array<[string, string | RegExp]> = [
    ["/app/library", /Library/i],
    ["/app/inbox", /Looks good/i],
    ["/app/accounts", /Duskly Team/i],
    ["/app/team", /owner@example.com/i],
    ["/app/agent", /Announce Friday drop/i],
    ["/app/analytics", /Published/i],
    ["/app/settings", /Workspace ID/i],
    ["/app/billing", /self-host|pricing|billing/i],
  ];
  for (const [path, text] of pages) {
    await page.goto(path);
    await expectReady(page, text);
  }
});

test("composer uses copilot and schedules a selected channel", async ({ page }) => {
  const created: unknown[] = [];
  await page.route("http://localhost:8787/v1/posts", async (route) => {
    if (route.request().method() === "POST") {
      created.push(route.request().postDataJSON());
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: "post-new" }) });
    }
    return route.fallback();
  });

  await page.goto("/app/compose");
  await page.getByRole("button", { name: "Write caption" }).click();
  await expect(page.getByPlaceholder("What are you posting?")).toHaveValue(/AI-written launch caption/);
  await page.getByRole("button", { name: "Schedule post" }).last().click();

  await expect.poll(() => created.length).toBe(1);
  expect(created[0]).toMatchObject({
    workspaceId: "ws-e2e",
    body: "AI-written launch caption",
  });
});

test("accounts can add token channels, filter the board, and save client groups", async ({ page }) => {
  await page.goto("/app/accounts");
  await page.getByRole("button", { name: "Add channel" }).first().click();
  await page.getByRole("radio", { name: "Bluesky" }).click();
  await page.getByLabel(/Handle/).fill("duskly.bsky.social");
  await page.getByLabel("App password").fill("app-password");
  await page.getByRole("button", { name: /Connect Bluesky/i }).click();

  await page.getByText("Client brands").click();
  await page.getByLabel("New company").fill("Northwind");
  await page.getByRole("button", { name: "Add company" }).click();
  await page.getByPlaceholder("Search handle…").fill("duskly");
  await expectReady(page, "Duskly Team");
});

test("settings covers workspace, signatures, sets, groups, rss, plugs, tokens, and webhooks", async ({ page }) => {
  await page.goto("/app/settings");
  await page.getByLabel("Custom domain").fill("social.example.com");
  await page.getByLabel("Failure email").fill("ops@example.com");
  await page.getByRole("button", { name: "Save studio" }).click();

  await page.getByRole("button", { name: "Signatures" }).click();
  await page.getByPlaceholder("Name").fill("Launch footer");
  await page.getByPlaceholder("via Duskly").fill("Ship calmly");
  await page.getByRole("button", { name: "Add Signature" }).click();

  await page.getByRole("button", { name: "Posting sets" }).click();
  await page.getByPlaceholder("Set name").fill("Weekly launch");
  await page.getByText("LinkedIn · Duskly Team").click();
  await page.getByRole("button", { name: "Create Posting Set" }).click();

  await page.getByRole("button", { name: "Client brands" }).click();
  await page.getByPlaceholder("Client / brand").fill("Northwind");
  await page.getByRole("button", { name: "Add Customer Group" }).click();

  await page.getByRole("button", { name: "RSS" }).click();
  await page.getByPlaceholder("https://blog.example.com/feed").fill("https://example.com/feed.xml");
  await page.getByRole("button", { name: "Watch Feed" }).first().click();

  await page.getByRole("button", { name: "Plugs" }).click();
  await page.getByPlaceholder("Plug name").fill("Manual reminder");
  await page.getByRole("button", { name: "Add internal" }).click();

  await page.getByRole("button", { name: "API tokens" }).click();
  await page.getByRole("button", { name: "Create Token" }).click();
  await expectReady(page, "dk_e2e_token");

  await page.getByRole("button", { name: "Webhooks" }).click();
  await page.getByPlaceholder("Name").fill("Ops hook");
  await page.getByPlaceholder("https://example.com/hook").fill("https://example.com/hook");
  await page.getByRole("button", { name: "Add Webhook" }).click();
});

test("team, agent, inbox, media, analytics, and preview actions work with mocked API", async ({ page }) => {
  await page.goto("/app/team");
  await page.getByPlaceholder("teammate@studio.com").fill("sam@example.com");
  await page.getByRole("button", { name: "Invite" }).click();
  await expectReady(page, /Invite emailed/i);

  await page.goto("/app/agent");
  await page.getByPlaceholder("Announce our Friday drop…").fill("Draft a launch post");
  await page.getByRole("button", { name: "Run agent" }).click();
  await expectReady(page, /post-agent/i);

  await page.goto("/app/inbox");
  await page.getByPlaceholder("Reply").fill("Thanks");
  await page.getByRole("button", { name: "Send" }).click();

  await page.goto("/app/library");
  await expect(page.getByRole("link", { name: "Use" })).toBeVisible();

  await page.goto("/app/analytics");
  await expectReady(page, "3");
  await expectReady(page, "@dusklycafe");

  await page.goto("/p/pub-1");
  await expectReady(page, "Public preview body");
});
