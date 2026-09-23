import { afterEach, describe, expect, it, vi } from "vitest";
import { NETWORK_META, adapters } from "../lib/networks";
import { REDDIT_UA } from "../lib/oauth-tokens";

const pending = {
  body: "hello",
  handle: "duskly",
  token: "pending",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function spyFetch() {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("publish adapters — missing credentials stay queued", () => {
  it("Slack OAuth without a bot token queues instead of publishing", async () => {
    const fetch = spyFetch();
    const result = await adapters.slack.publish(pending);
    expect(result).toEqual({ queued: true, reason: expect.stringMatching(/Slack bot token/i) });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("Slack with a webhook-shaped token (not a bot token) queues", async () => {
    const fetch = spyFetch();
    const result = await adapters.slack.publish({
      ...pending,
      token: "https://hooks.slack.com/services/T/B/xxx",
      credentials: { channelId: "C123" },
    });
    expect(result).toMatchObject({ queued: true });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("Slack with a bot token but no channel queues", async () => {
    const fetch = spyFetch();
    const result = await adapters.slack.publish({
      ...pending,
      token: "xoxb-real-token",
    });
    expect(result).toEqual({ queued: true, reason: expect.stringMatching(/channel/i) });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("Discord without a webhook URL queues", async () => {
    const fetch = spyFetch();
    const result = await adapters.discord.publish(pending);
    expect(result).toMatchObject({ queued: true });
    expect(String("reason" in result ? result.reason : "")).toMatch(/Discord webhook/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("Discord token that is not an http URL queues", async () => {
    const fetch = spyFetch();
    const result = await adapters.discord.publish({ ...pending, token: "not-a-url" });
    expect(result).toMatchObject({ queued: true });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("dev.to without an API key queues", async () => {
    const fetch = spyFetch();
    const result = await adapters.devto.publish(pending);
    expect(result).toEqual({ queued: true, reason: expect.stringMatching(/dev\.to API key/i) });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("Instagram without OAuth page id queues", async () => {
    const fetch = spyFetch();
    const result = await adapters.instagram.publish(pending);
    expect(result).toMatchObject({ queued: true });
    expect(String("reason" in result ? result.reason : "")).toMatch(/instagram/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("Instagram with token but no image URL queues (caption-only)", async () => {
    const fetch = spyFetch();
    const result = await adapters.instagram.publish({
      ...pending,
      token: "IG_TOKEN",
      credentials: { accessToken: "IG_TOKEN", igUserId: "1784" },
    });
    expect(result).toMatchObject({ queued: true });
    expect(String("reason" in result ? result.reason : "")).toMatch(/image URL/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("Bluesky without an app password queues and does not hit ATProto", async () => {
    const fetch = spyFetch();
    const result = await adapters.bluesky.publish(pending);
    expect(result).toMatchObject({ queued: true });
    expect(String("reason" in result ? result.reason : "")).toMatch(/Bluesky/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("YouTube text-only posts stay queued with a clear reason", async () => {
    const fetch = spyFetch();
    const result = await adapters.youtube.publish({
      ...pending,
      token: "ya29.token",
      credentials: { accessToken: "ya29.token" },
    });
    expect(result).toMatchObject({ queued: true });
    expect(String("reason" in result ? result.reason : "")).toMatch(/video file/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("YouTube with video bytes starts a resumable videos.insert upload", async () => {
    const fetch = spyFetch();
    fetch
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: (h: string) => (h === "location" ? "https://upload.googleapis.com/youtube/resumable/1" : null) },
        text: async () => "",
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "vid123" }),
        text: async () => "",
      });
    const result = await adapters.youtube.publish({
      ...pending,
      token: "ya29.token",
      credentials: { accessToken: "ya29.token" },
      videoBytes: new TextEncoder().encode("fake-mp4").buffer,
      videoContentType: "video/mp4",
    });
    expect(result).toMatchObject({ remoteId: "vid123" });
    expect(String(fetch.mock.calls[0][0])).toContain(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable",
    );
    expect(String(fetch.mock.calls[1][0])).toBe("https://upload.googleapis.com/youtube/resumable/1");
  });

  it("Instagram publish uses the professional account id, not a Facebook user id alias", async () => {
    const fetch = spyFetch();
    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "container" }), text: async () => "" })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "igmedia" }), text: async () => "" });
    const result = await adapters.instagram.publish({
      ...pending,
      token: "PAGE_TOKEN",
      credentials: { accessToken: "PAGE_TOKEN", igUserId: "1784", pageId: "page-9", imageUrl: "https://cdn.example/p.jpg" },
    });
    expect(result).toMatchObject({ remoteId: "igmedia" });
    expect(String(fetch.mock.calls[0][0])).toContain("/1784/media");
    expect(String(fetch.mock.calls[0][0])).not.toContain("/page-9/media");
  });

  it("Facebook publish posts to the Page id with the Page token", async () => {
    const fetch = spyFetch();
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: "page_post" }), text: async () => "" });
    const result = await adapters.facebook.publish({
      ...pending,
      token: "PAGE_TOKEN",
      credentials: { accessToken: "PAGE_TOKEN", pageId: "111" },
    });
    expect(result).toMatchObject({ remoteId: "page_post" });
    expect(String(fetch.mock.calls[0][0])).toBe("https://graph.facebook.com/v21.0/111/feed");
  });

  it("Reddit submit sends the identifying User-Agent", async () => {
    const fetch = spyFetch();
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ json: { data: { name: "t3_abc" } } }),
      text: async () => "",
    });
    const result = await adapters.reddit.publish({
      ...pending,
      token: "reddit-token",
      credentials: { accessToken: "reddit-token", subreddit: "duskly" },
    });
    expect(result).toMatchObject({ remoteId: "t3_abc" });
    expect(fetch.mock.calls[0][1].headers["user-agent"]).toBe(REDDIT_UA);
    expect(REDDIT_UA).toContain("duskly.site");
  });

  it("does not mark Slack as a token-connect network (OAuth path)", () => {
    expect(NETWORK_META.slack.connect).toBe("oauth");
    expect(NETWORK_META.discord.connect).toBe("token");
    expect(NETWORK_META.devto.connect).toBe("token");
    expect(NETWORK_META.instagram.connect).toBe("oauth");
    expect(NETWORK_META.bluesky.connect).toBe("token");
  });
});
