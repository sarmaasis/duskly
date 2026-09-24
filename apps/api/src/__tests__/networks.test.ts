import { afterEach, describe, expect, it, vi } from "vitest";
import { NETWORKS, NETWORK_META, adapters, firstPublishMedia, isVideoMedia } from "../lib/networks";
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

  it("LinkedIn publishes through the current Posts API with a version header", async () => {
    const fetch = spyFetch();
    fetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: (h: string) => (h.toLowerCase() === "x-restli-id" ? "urn:li:share:123" : null) },
      json: async () => ({}),
      text: async () => "",
    });
    const result = await adapters.linkedin.publish({
      ...pending,
      token: "li-token",
      credentials: { accessToken: "li-token", authorUrn: "urn:li:person:abc" },
    });
    expect(result).toMatchObject({ remoteId: "urn:li:share:123" });
    expect(String(fetch.mock.calls[0][0])).toBe("https://api.linkedin.com/rest/posts");
    expect(fetch.mock.calls[0][1].headers["linkedin-version"]).toBe("202603");
    const body = JSON.parse(String(fetch.mock.calls[0][1].body));
    expect(body.commentary).toBe("hello");
    expect(body.distribution.feedDistribution).toBe("MAIN_FEED");
  });

  it("YouTube with only a videoId (comment-on-existing) stays queued — upload-only", async () => {
    const fetch = spyFetch();
    const result = await adapters.youtube.publish({
      ...pending,
      token: "ya29.token",
      credentials: { accessToken: "ya29.token", videoId: "abc" },
    });
    expect(result).toMatchObject({ queued: true });
    expect(String("reason" in result ? result.reason : "")).toMatch(/video file/i);
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
    const body = fetch.mock.calls[0][1].body as URLSearchParams;
    expect(body.get("sr")).toBe("duskly");
  });

  it("Reddit publish uses the persisted OAuth subreddit, not the u/ handle", async () => {
    const fetch = spyFetch();
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ json: { data: { name: "t3_xyz" } } }),
      text: async () => "",
    });
    const result = await adapters.reddit.publish({
      body: "hello",
      handle: "u/alice",
      token: "reddit-token",
      credentials: { accessToken: "reddit-token", subreddit: "r/duskly" },
    });
    expect(result).toMatchObject({ remoteId: "t3_xyz" });
    const body = fetch.mock.calls[0][1].body as URLSearchParams;
    expect(body.get("sr")).toBe("duskly");
  });

  it("Reddit without a stored subreddit and a u/ handle stays queued", async () => {
    const fetch = spyFetch();
    const result = await adapters.reddit.publish({
      body: "hello",
      handle: "u/alice",
      token: "reddit-token",
      credentials: { accessToken: "reddit-token", subreddit: "" },
    });
    expect(result).toMatchObject({ queued: true });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not mark Slack as a token-connect network (OAuth path)", () => {
    expect(NETWORK_META.slack.connect).toBe("oauth");
    expect(NETWORK_META.discord.connect).toBe("token");
    expect(NETWORK_META.devto.connect).toBe("token");
    expect(NETWORK_META.instagram.connect).toBe("oauth");
    expect(NETWORK_META.bluesky.connect).toBe("token");
  });

  it("does not offer Medium as a connectable network; leftover rows queue without calling Medium", async () => {
    expect(NETWORKS).not.toContain("medium");
    const fetch = spyFetch();
    const result = await adapters.medium.publish({
      body: "hello",
      handle: "author",
      token: "medium-token",
      credentials: { integrationToken: "medium-token", authorId: "abc" },
    });
    expect(result).toEqual({ queued: true, reason: expect.stringMatching(/Medium was removed/i) });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("first-media publish pick", () => {
  const rows = [
    { id: "v1", kind: "clip", contentType: "video/mp4" },
    { id: "i1", kind: "image", contentType: "image/png" },
    { id: "i2", kind: "image", contentType: "image/jpeg" },
  ];

  it("uses composer order, not row order", () => {
    expect(firstPublishMedia(["i2", "v1"], rows)?.id).toBe("i2");
    expect(firstPublishMedia(["v1", "i1"], rows)?.id).toBe("v1");
  });

  it("classifies clips as video", () => {
    expect(isVideoMedia(rows[0])).toBe(true);
    expect(isVideoMedia(rows[1])).toBe(false);
  });
});
