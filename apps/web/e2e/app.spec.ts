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
    ["/docs/getting-started", /Your first post/i],
    ["/docs/self-host", /Self-host on Cloudflare/i],
    ["/docs/accounts", /Connect social accounts/i],
    ["/docs/operations", /Updates, backups, and recovery/i],
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
  await expectReady(page, "Posts");
});

test("app shell navigation, alerts, and core authenticated pages render", async ({ page }) => {
  await page.goto("/app");
  await expectReady(page, "Launch notes are live");

  await page.getByRole("button", { name: "Delivery updates" }).first().click();
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
  await expect(page.getByText("Click to upload pictures")).toHaveCount(0);
  await page.getByRole("button", { name: "Image post", exact: true }).click();
  await expect(page.getByText("Click to upload pictures")).toBeVisible();
  await page.getByRole("button", { name: "Change post type" }).click();
  await page.getByRole("button", { name: "Video post", exact: true }).click();
  await expect(page.getByText("Click to upload a video")).toBeVisible();
  await expect(page.getByText("Click to upload pictures")).toHaveCount(0);
  await page.locator('input[type="file"][accept="video/*"]').setInputFiles({
    name: "clip.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("not-a-real-video"),
  });
  await expect(page.getByRole("button", { name: "Use this frame" })).toBeVisible();
  await page.getByLabel("Upload thumbnail").setInputFiles({
    name: "cover.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  });
  await expect(page.getByRole("img", { name: "Video thumbnail" })).toBeVisible();
  await page.getByRole("button", { name: "Change post type" }).click();
  await page.getByRole("button", { name: "Text post", exact: true }).click();
  await page.getByRole("button", { name: "Write caption" }).click();
  await expect(page.getByPlaceholder("What are you posting?")).toHaveValue(/AI-written launch caption/);
  await page.getByRole("button", { name: "Use the next free time" }).click();
  await page.getByRole("button", { name: "Schedule post", exact: true }).click();

  await expect.poll(() => created.length).toBe(1);
  expect(created[0]).toMatchObject({
    workspaceId: "ws-e2e",
    body: "AI-written launch caption",
    status: "scheduled",
  });
});

test("accounts can add token channels, filter the board, and save client groups", async ({ page }) => {
  await page.goto("/app/accounts");
  await page.getByRole("button", { name: "Add a Bluesky account" }).click();
  await page.getByLabel(/Handle/).fill("duskly.bsky.social");
  await page.getByLabel("App password").fill("app-password");
  await page.getByRole("button", { name: /Connect Bluesky/i }).click();

  await page.getByText("Organize by company", { exact: false }).click();
  await page.getByLabel("New company").fill("Northwind");
  await page.getByRole("button", { name: "Add company" }).click();
  await page.getByPlaceholder("Search handle…").fill("duskly");
  await expectReady(page, "Duskly Team");
});

test("a long agency list stays on companies until you pick one or search", async ({ page }) => {
  const many = Array.from({ length: 12 }, (_, i) => ({
    id: `acc-${i}`,
    network: "linkedin",
    handle: i === 0 ? "Northwind HQ" : `channel-${i}`,
    status: "active",
    groupId: `grp-${i % 4}`,
  }));
  const groups = Array.from({ length: 4 }, (_, i) => ({
    id: `grp-${i}`,
    name: `Client ${i + 1}`,
    accountIds: many.filter((account) => account.groupId === `grp-${i}`).map((account) => account.id),
  }));
  await page.route("**/v1/accounts?*", (route) => route.fulfill({ json: { accounts: many, networks: ["linkedin"], next: null } }));
  await page.route("**/v1/org/groups?*", (route) => route.fulfill({ json: { groups } }));
  await page.goto("/app/accounts");
  await expect(page.getByRole("button", { name: "Add a LinkedIn account" })).toBeVisible();
  await expect(page.getByText("Northwind HQ")).toBeVisible();
  await page.getByRole("button", { name: "Client 2", exact: true }).click();
  await expect(page.getByText("Northwind HQ")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add a LinkedIn account" })).toBeVisible();
  await page.getByRole("button", { name: "All companies" }).click();
  await page.getByRole("button", { name: "Add a LinkedIn account" }).click();
  await expect(page.getByRole("combobox", { name: "Company", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Client 1", exact: true }).click();
  await expect(page.getByText("Northwind HQ")).toBeVisible();
  await page.evaluate(() => localStorage.removeItem("dk-company"));
  await page.goto("/app/compose");
  await page.getByRole("button", { name: "Text post", exact: true }).click();
  await expect(page.getByText("Find an account")).toBeVisible();
  await expect(page.getByRole("button", { name: /channel-11/ })).toHaveCount(0);
  await page.getByPlaceholder("Search by name").fill("channel-11");
  await expect(page.getByRole("button", { name: /channel-11/ })).toBeVisible();
  await page.goto("/app/settings");
  await page.getByRole("button", { name: "Client brands" }).click();
  await expect(page.getByPlaceholder("Search brands")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save assignments" })).toHaveCount(1);
  await page.getByRole("button", { name: /Client 4/ }).click();
  await page.getByPlaceholder("Search by name").fill("channel-11");
  await page.getByRole("button", { name: /channel-11/ }).first().click();
  await page.getByRole("button", { name: "Save assignments" }).click();
  await expect(page.getByText(/Saved/)).toBeVisible();
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
  await page.getByRole("button", { name: "Save assignments" }).first().click();
  await expect(page.getByText(/Saved/)).toBeVisible();

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

test("compact navigation keeps one new-post action and follows route history", async ({ page }) => {
  await page.goto('/app');
  const nav = page.getByRole('navigation', { name: 'Main navigation', exact: true });
  await expect(nav.getByRole('link', { name: 'Posts', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('link', { name: 'New post', exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Launch notes are live', exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('posts-desktop.png') });
  await nav.getByRole('link', { name: 'Accounts', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/accounts$/);
  await expect(nav.getByRole('link', { name: 'Accounts', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.goBack();
  await expect(nav.getByRole('link', { name: 'Posts', exact: true })).toHaveAttribute('aria-current', 'page');
  const delivery = page.getByRole('button', { name: 'Delivery updates', exact: true });
  await delivery.click();
  await expect(page.getByRole('dialog', { name: 'Delivery updates' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Delivery updates' })).not.toBeVisible();
  await expect(delivery).toBeFocused();
});

test("sidebar lists every destination, including theme and help", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app');
  await expect(page.getByRole('heading', { name: 'Posts', exact: true })).toBeVisible();
  await expect(page.getByLabel('Company filter')).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('posts-mobile.png') });
  const nav = page.getByRole('navigation', { name: 'Main navigation', exact: true });
  await expect(nav.getByRole('link', { name: /^Billing/ })).toHaveCount(0);
  for (const name of ['Media library', 'Replies', 'AI assistant', 'Team', 'Settings']) {
    await nav.getByRole('link', { name: name, exact: true }).click();
    await expect(nav.getByRole('link', { name: name, exact: true })).toHaveAttribute('aria-current', 'page');
  }
  await page.getByRole('button', { name: 'Theme: light' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByRole('button', { name: 'Theme: dark' })).toBeVisible();
  await page.getByRole('link', { name: 'Posts', exact: true }).click();
  await page.screenshot({ path: test.info().outputPath('posts-dark-mobile.png') });
  await nav.getByRole('link', { name: 'Help & documentation' }).click();
  await expect(page).toHaveURL(/\/docs$/);
});

test("Cloud billing stays in the sidebar on desktop and mobile", async ({ page }) => {
  await mockApi(page, { cloud: true });
  await page.goto('/app');
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.getByText('E2E Studio', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Billing', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/billing$/);
  }
});

test("delivery failures offer retry instead of a false empty state", async ({ page }) => {
  await page.route('**/v1/posts?*', async (route) => {
    if (new URL(route.request().url()).searchParams.has('issues')) return route.fulfill({ status: 503, body: 'Unavailable' });
    return route.fallback();
  });
  await page.goto('/app');
  await page.getByRole('button', { name: 'Delivery updates', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Delivery updates' });
  await expect(dialog.getByText('Could not load publishing notifications. Try again.')).toBeVisible();
  await expect(dialog.getByText('Nothing waiting')).toHaveCount(0);
  await page.unroute('**/v1/posts?*');
  await dialog.getByRole('button', { name: 'Retry notifications' }).click();
  await expect(dialog.getByText('Needs attention', { exact: true })).toBeVisible();
});

test("failed sign-out keeps the workspace and successful retry exits", async ({ page }) => {
  await page.goto('/app');
  await page.route('**/api/auth/sign-out', (route) => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByText('Could not sign out. Please try again.')).toBeVisible();
  await expect(page).toHaveURL(/\/app$/);
  await page.unroute('**/api/auth/sign-out');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("empty workspace gives a direct first-account flow instead of a blank calendar", async ({ page }) => {
  await page.route('**/v1/posts?*', (route) => route.fulfill({ json: { posts: [], next: null } }));
  await page.route('**/v1/accounts?*', (route) => route.fulfill({ json: { accounts: [], networks: ['bluesky'], next: null } }));
  await page.route('**/v1/org/groups?*', (route) => route.fulfill({ json: { groups: [] } }));
  await page.goto('/app');
  await expect(page.getByRole('heading', { name: 'Connect an account. Make it yours.' })).toBeVisible();
  await expect(page.getByLabel('Company filter')).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath('first-use.png') });
  await page.getByRole('link', { name: 'Connect your first account' }).click();
  await expect(page).toHaveURL(/\/app\/accounts$/);
  await expect(page.getByRole('button', { name: 'Add a Bluesky account' })).toBeVisible();
  await expect(page.getByLabel('New company')).not.toBeVisible();
});

test("post views distinguish empty filters, drafts and calendar", async ({ page }) => {
  await page.goto('/app');
  await page.getByRole('group', { name: 'Post status' }).getByRole('button', { name: 'Drafts', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No posts match this view' })).toBeVisible();
  await page.getByRole('button', { name: 'Show all posts' }).click();
  await expect(page.getByRole('button', { name: 'Launch notes are live', exact: true })).toBeVisible();
  await page.getByRole('group', { name: 'Post view' }).getByRole('button', { name: 'Calendar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Previous month' })).toBeVisible();
  await page.getByRole('group', { name: 'Post view' }).getByRole('button', { name: 'List', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Previous month' })).not.toBeVisible();
  await expect(page.getByText('Duskly Team').first()).toBeVisible();
  await page.getByRole('button', { name: 'Launch notes are live', exact: true }).click();
  await expect(page.getByLabel('Post text')).toHaveValue('Launch notes are live');
});

test("composer saves a draft without pretending to schedule or creating duplicates", async ({ page }) => {
  const writes: Array<{ method: string; data: Record<string, unknown> }> = [];
  await page.route('**/v1/posts**', async (route) => {
    if (['POST', 'PATCH'].includes(route.request().method())) {
      writes.push({ method: route.request().method(), data: route.request().postDataJSON() });
      return route.fulfill({ json: { id: 'new-draft' } });
    }
    return route.fallback();
  });
  await page.goto('/app/compose');
  await expect(page.getByRole('link', { name: 'New post', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Text post', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Usage this month' })).toBeVisible();
  await expect(page.getByText('2 of 25')).toBeVisible();
  await expect(page.getByText('Signatures, tags, and imports')).toBeVisible();
  await page.getByLabel('Post text').fill('A draft worth keeping');
  await page.screenshot({ path: test.info().outputPath('composer.png') });
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].data).toMatchObject({ status: 'draft', body: 'A draft worth keeping' });
  expect(writes[0].data.scheduledAt).toBeUndefined();
  await expect(page.getByLabel('Post text')).toHaveValue('A draft worth keeping');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1].method).toBe('PATCH');
});
