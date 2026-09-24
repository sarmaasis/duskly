import { expect, type Page, type Route } from "@playwright/test";

const workspace = {
  id: "ws-e2e",
  name: "E2E Studio",
  plan: "pro",
  theme: "light",
  signature: null,
  onboardingCompleted: true,
  role: "owner",
  extrasJson: JSON.stringify({
    hashtags: [{ id: "hash-1", name: "Launch", tags: "#launch #duskly" }],
  }),
};

const usage = {
  plan: "pro",
  period: "month",
  limits: {
    channels: 12,
    team: true,
    aiImages: 25,
    aiVideos: 10,
    aiClipMinutes: 60,
    aiCopilot: 100,
  },
  used: {
    channels: 3,
    aiImages: 2,
    aiVideos: 1,
    aiCopilot: 4,
  },
};

const accounts = [
  { id: "acc-linkedin", network: "linkedin", handle: "Duskly Team", status: "active", groupId: "grp-1", queueSlots: "09:00,13:00" },
  { id: "acc-instagram", network: "instagram", handle: "@dusklycafe", status: "active", groupId: null, queueSlots: "" },
  { id: "acc-slack", network: "slack", handle: "Duskly", status: "active", groupId: null, slackChannelId: "C1", slackChannelName: "launch" },
];

const networks = [
  "linkedin",
  "x",
  "instagram",
  "threads",
  "facebook",
  "youtube",
  "reddit",
  "bluesky",
  "mastodon",
  "hashnode",
  "devto",
  "telegram",
  "discord",
  "slack",
];

const meta = {
  linkedin: { label: "LinkedIn", group: "social", connect: "oauth" },
  x: { label: "X", group: "social", connect: "oauth" },
  instagram: { label: "Instagram", group: "social", connect: "oauth" },
  threads: { label: "Threads", group: "social", connect: "oauth" },
  facebook: { label: "Facebook", group: "social", connect: "oauth" },
  youtube: { label: "YouTube", group: "social", connect: "oauth" },
  reddit: { label: "Reddit", group: "social", connect: "oauth" },
  bluesky: { label: "Bluesky", group: "social", connect: "token" },
  mastodon: { label: "Mastodon", group: "social", connect: "oauth" },
  hashnode: { label: "Hashnode", group: "blogs", connect: "token" },
  devto: { label: "dev.to", group: "blogs", connect: "token" },
  telegram: { label: "Telegram", group: "chat", connect: "token" },
  discord: { label: "Discord", group: "chat", connect: "token" },
  slack: { label: "Slack", group: "chat", connect: "oauth" },
};

const posts = [
  {
    id: "post-1",
    body: "Launch notes are live",
    status: "scheduled",
    scheduledAt: new Date().toISOString(),
    extrasJson: JSON.stringify({ tags: ["launch"], previewToken: "pub-1" }),
    repeatRule: "weekly",
    preview: null,
    channels: [{ accountId: "acc-linkedin", network: "linkedin", handle: "Duskly Team", status: "scheduled" }],
    issues: [],
  },
  {
    id: "post-2",
    body: "Queued image post",
    status: "queued",
    scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
    extrasJson: JSON.stringify({ tags: ["ops"] }),
    preview: { url: "/assets/logos/instagram.svg", kind: "image" },
    channels: [{ accountId: "acc-instagram", network: "instagram", handle: "@dusklycafe", status: "queued" }],
    issues: [],
  },
  {
    id: "post-3",
    body: "Needs attention",
    status: "failed",
    scheduledAt: new Date(Date.now() + 172_800_000).toISOString(),
    extrasJson: "{}",
    preview: null,
    channels: [{ accountId: "acc-slack", network: "slack", handle: "#launch", status: "failed" }],
    issues: [{ network: "slack", handle: "#launch", status: "failed", error: "Webhook rejected" }],
  },
];

const groups = [{ id: "grp-1", name: "Acme Co", accountIds: ["acc-linkedin"] }];
const signatures = [{ id: "sig-1", name: "Default", body: "via Duskly", isDefault: true }];
const sets = [{ id: "set-1", name: "Launch set", channelIds: JSON.stringify(["acc-linkedin", "acc-instagram"]), templateBody: "Launch: " }];
const feeds = [{ id: "rss-1", url: "https://example.com/feed.xml" }];
const plugs = [{ id: "plug-1", name: "Create reminder", scope: "internal", triggerType: "manual" }];

export async function mockApi(page: Page, options: { loggedIn?: boolean } = {}) {
  const loggedIn = options.loggedIn ?? true;
  await page.route("http://localhost:8787/**", async (route) => handleApi(route, loggedIn));
}

async function handleApi(route: Route, loggedIn: boolean) {
  const req = route.request();
  const url = new URL(req.url());
  const path = url.pathname;

  if (path === "/api/auth/get-session") {
    return json(route, loggedIn ? { user: { id: "user-1", email: "owner@example.com", name: "Owner" }, session: { id: "s1" } } : {});
  }
  if (path === "/api/auth/sign-out") return json(route, {});
  if (path === "/api/auth/email-otp/send-verification-otp") return json(route, { ok: true });
  if (path === "/api/auth/sign-in/email-otp") return json(route, { user: { id: "user-1" } });

  if (!loggedIn && path.startsWith("/v1/")) return json(route, { message: "unauthorized" }, 401);

  if (path === "/v1/workspaces/me") return json(route, { workspace, usage, cloud: false });
  if (/^\/v1\/workspaces\/[^/]+\/usage$/.test(path)) return json(route, usage);
  if (/^\/v1\/workspaces\/[^/]+$/.test(path)) return json(route, { ok: true });

  if (path === "/v1/accounts/oauth/status") return json(route, Object.fromEntries(networks.map((n) => [n, true])));
  if (path === "/v1/accounts") {
    if (req.method() === "POST") return json(route, { ok: true, id: "acc-new" });
    return json(route, { accounts, networks, meta, next: null });
  }
  if (/^\/v1\/accounts\/[^/]+$/.test(path)) return json(route, { ok: true });
  if (/^\/v1\/accounts\/[^/]+\/slack\/channels$/.test(path)) {
    return json(route, { channels: [{ id: "C1", name: "launch", isPrivate: false }, { id: "C2", name: "ops", isPrivate: false }] });
  }

  if (path === "/v1/posts") {
    if (req.method() === "POST") return json(route, { id: "post-new" }, 201);
    return json(route, { posts, next: null });
  }
  if (path === "/v1/posts/import") return json(route, { ids: ["post-imported"] });
  if (/^\/v1\/posts\/[^/]+\/(queue-now|pause|decide|duplicate)$/.test(path)) return json(route, { ok: true });
  if (/^\/v1\/posts\/[^/]+$/.test(path)) return json(route, { ok: true });
  if (path.startsWith("/v1/posts/public/")) {
    return json(route, { body: "Public preview body", status: "scheduled", studio: "E2E Studio", media: [] });
  }

  if (path === "/v1/media") {
    return json(route, { media: [{ id: "media-1", kind: "image", previewUrl: "/assets/logos/instagram.svg", bytes: 2048 }], next: null });
  }
  if (path === "/v1/media/upload") return json(route, { id: "media-upload", url: "/assets/logos/linkedin.svg", contentType: "image/svg+xml" }, 201);

  if (path === "/v1/org/groups") return req.method() === "POST" ? json(route, { id: "grp-new" }, 201) : json(route, { groups });
  if (/^\/v1\/org\/groups\/[^/]+\/accounts$/.test(path)) return json(route, { ok: true });
  if (path === "/v1/org/signatures") return req.method() === "POST" ? json(route, { id: "sig-new" }, 201) : json(route, { signatures });
  if (/^\/v1\/org\/signatures\/[^/]+\/default$/.test(path)) return json(route, { ok: true });
  if (path === "/v1/org/sets") return req.method() === "POST" ? json(route, { id: "set-new" }, 201) : json(route, { sets });
  if (path === "/v1/org/rss") return req.method() === "POST" ? json(route, { id: "rss-new" }, 201) : json(route, { feeds });
  if (path === "/v1/org/plugs") return req.method() === "POST" ? json(route, { id: "plug-new" }, 201) : json(route, { plugs });
  if (/^\/v1\/org\/plugs\/[^/]+\/run$/.test(path)) return json(route, { ok: true });
  if (path === "/v1/org/tokens") {
    return req.method() === "POST"
      ? json(route, { token: "dk_e2e_token" }, 201)
      : json(route, { tokens: [{ id: "tok-1", name: "CLI", tokenPrefix: "dk_e2e" }] });
  }
  if (path === "/v1/org/integrations") {
    return req.method() === "POST"
      ? json(route, { id: "hook-new" }, 201)
      : json(route, { integrations: [{ id: "hook-1", name: "Deploy hook", url: "https://example.com/hook" }] });
  }
  if (path === "/v1/org/analytics") {
    return json(route, {
      totals: { posts: 3, published: 1, byStatus: { scheduled: 1, queued: 1, failed: 1 } },
      byDay: { [new Date().toISOString().slice(0, 10)]: 2 },
      channels: [{ network: "linkedin", handle: "Duskly Team", published: 1, queued: 1, failed: 0, pending: 0 }],
      recent: posts.map((p) => ({ id: p.id, body: p.body, status: p.status, at: Date.now(), channels: p.channels })),
      engagement: [{ network: "instagram", handle: "@dusklycafe", likes: 12, comments: 3, reach: 400 }],
    });
  }

  if (path === "/v1/team") return json(route, { members: [{ userId: "user-1", email: "owner@example.com", role: "owner" }], invites: [] });
  if (path === "/v1/team/invite") return json(route, { id: "invite-new" }, 201);
  if (/^\/v1\/team\/(member|invite)\/[^/]+$/.test(path)) return json(route, { ok: true });

  if (path === "/v1/ai/agent") {
    return req.method() === "POST"
      ? json(route, { ok: true, postId: "post-agent" })
      : json(route, { runs: [{ id: "run-1", prompt: "Announce Friday drop", status: "done" }] });
  }
  if (path === "/v1/ai/copilot") return json(route, { draft: "AI-written launch caption" });
  if (path === "/v1/ai/image") return json(route, { id: "media-ai", url: "/assets/logos/bluesky.svg" }, 201);
  if (path === "/v1/ai/video") return json(route, { id: "media-video", url: "/assets/logos/youtube.svg", contentType: "video/mp4" }, 201);
  if (path === "/v1/ai/mentions") return json(route, { handles: [{ handle: "duskly", network: "instagram" }] });

  if (path === "/v1/inbox") {
    return json(route, { items: [{ id: "inbox-1", network: "slack", handle: "#launch", text: "Looks good", accountId: "acc-slack" }], next: null });
  }
  if (path === "/v1/inbox/reply") return json(route, { ok: true });

  if (path === "/v1/billing/checkout") return json(route, { checkout_url: "https://billing.example/checkout" });

  return json(route, { ok: true });
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

export async function expectReady(page: Page, text: string | RegExp) {
  await expect(page.getByText(text).first()).toBeVisible();
}
