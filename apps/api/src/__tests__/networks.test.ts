import { afterEach, describe, expect, it, vi } from "vitest";
import { NETWORKS, NETWORK_META, adapters, firstPublishMedia, isImageMedia, isVideoMedia } from "../lib/networks";
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
    expect(fetch.mock.calls[0][1].headers["linkedin-version"]).toBe("202601");
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
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "container" }), text: async () => JSON.stringify({ id: "container" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status_code: "FINISHED" }), text: async () => JSON.stringify({ status_code: "FINISHED" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "igmedia" }), text: async () => JSON.stringify({ id: "igmedia" }) });
    const result = await adapters.instagram.publish({
      ...pending,
      token: "PAGE_TOKEN",
      credentials: { accessToken: "PAGE_TOKEN", igUserId: "1784", pageId: "page-9", imageUrl: "https://cdn.example/p.jpg" },
    });
    expect(result).toMatchObject({ remoteId: "igmedia" });
    expect(String(fetch.mock.calls[0][0])).toBe("https://graph.facebook.com/v21.0/1784/media");
    expect(String(fetch.mock.calls[2][0])).toBe("https://graph.facebook.com/v21.0/1784/media_publish");
    expect(String(fetch.mock.calls[0][0])).not.toContain("/page-9/media");
  });

  it("Instagram Login publish uses graph.instagram.com with the user token, not a Page path", async () => {
    const fetch = spyFetch();
    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "container" }), text: async () => JSON.stringify({ id: "container" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status_code: "FINISHED" }), text: async () => JSON.stringify({ status_code: "FINISHED" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "igmedia" }), text: async () => JSON.stringify({ id: "igmedia" }) });
    const result = await adapters.instagram.publish({
      ...pending,
      token: "IG_USER_TOKEN",
      credentials: {
        accessToken: "IG_USER_TOKEN",
        igUserId: "1784",
        authKind: "instagram_login",
        imageUrl: "https://cdn.example/p.jpg",
      },
    });
    expect(result).toMatchObject({ remoteId: "igmedia" });
    const createUrl = new URL(String(fetch.mock.calls[0][0]));
    expect(`${createUrl.origin}${createUrl.pathname}`).toBe("https://graph.instagram.com/v26.0/1784/media");
    expect(createUrl.searchParams.get("image_url")).toBe("https://cdn.example/p.jpg");
    expect(createUrl.searchParams.get("caption")).toBe("hello");
    expect(createUrl.searchParams.get("access_token")).toBe("IG_USER_TOKEN");
    const createInit = fetch.mock.calls[0][1] as { body?: string; headers?: Record<string, string> };
    expect(createInit.body).toBeUndefined();
    expect(createInit.headers?.authorization).toBeUndefined();
    const publishUrl = new URL(String(fetch.mock.calls[2][0]));
    expect(`${publishUrl.origin}${publishUrl.pathname}`).toBe("https://graph.instagram.com/v26.0/1784/media_publish");
    expect(publishUrl.searchParams.get("creation_id")).toBe("container");
    expect(publishUrl.searchParams.get("access_token")).toBe("IG_USER_TOKEN");
    const publishInit = fetch.mock.calls[2][1] as { body?: string; headers?: Record<string, string> };
    expect(publishInit.body).toBeUndefined();
    expect(publishInit.headers?.authorization).toBeUndefined();
  });

  it("Instagram Login publish failures stay queued (no fake success)", async () => {
    const fetch = spyFetch();
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({}),
      text: async () => JSON.stringify({ error: { message: "Unsupported request - method type: post", code: 100 } }),
    });
    const result = await adapters.instagram.publish({
      ...pending,
      token: "IG_USER_TOKEN",
      credentials: {
        accessToken: "IG_USER_TOKEN",
        igUserId: "1784",
        authKind: "instagram_login",
        imageUrl: "https://cdn.example/p.jpg",
      },
    });
    expect(result).toMatchObject({ queued: true });
    expect(String("reason" in result ? result.reason : "")).toMatch(/Business Login token cannot publish yet/i);
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
    expect(isImageMedia(rows[1])).toBe(true);
    expect(isImageMedia(rows[0])).toBe(false);
  });
});

describe("caption+image scheduled publish must attach the photo", () => {
  const imageUrl = "https://api.duskly.site/v1/media/img-1/public?exp=1&sig=abc";
  const jpeg = new TextEncoder().encode("fake-jpeg").buffer;

  it("Facebook posts to /photos with url+caption, not caption-only /feed", async () => {
    const fetch = spyFetch();
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: "photo1", post_id: "111_99" }), text: async () => "" });
    const result = await adapters.facebook.publish({
      ...pending,
      token: "PAGE_TOKEN",
      credentials: { accessToken: "PAGE_TOKEN", pageId: "111", imageUrl },
    });
    expect(result).toMatchObject({ remoteId: "111_99" });
    expect(String(fetch.mock.calls[0][0])).toBe("https://graph.facebook.com/v21.0/111/photos");
    expect(String(fetch.mock.calls[0][0])).not.toContain("/feed");
    const body = JSON.parse(String(fetch.mock.calls[0][1].body));
    expect(body.url).toBe(imageUrl);
    expect(body.caption).toBe("hello");
    expect(body.message).toBeUndefined();
  });

  it("Facebook with image bytes uploads multipart to /photos, not /feed", async () => {
    const fetch = spyFetch();
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: "photo2" }), text: async () => "" });
    const result = await adapters.facebook.publish({
      ...pending,
      token: "PAGE_TOKEN",
      credentials: { accessToken: "PAGE_TOKEN", pageId: "111" },
      imageBytes: jpeg,
      imageContentType: "image/jpeg",
    });
    expect(result).toMatchObject({ remoteId: "photo2" });
    expect(String(fetch.mock.calls[0][0])).toBe("https://graph.facebook.com/v21.0/111/photos");
    expect(fetch.mock.calls[0][1].body).toBeInstanceOf(FormData);
  });

  it("Instagram Page-linked create includes image_url with the caption", async () => {
    const fetch = spyFetch();
    fetch
      .mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ id: "container" }) })
      .mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ status_code: "FINISHED" }) })
      .mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ id: "igmedia" }) });
    const result = await adapters.instagram.publish({
      ...pending,
      token: "PAGE_TOKEN",
      credentials: { accessToken: "PAGE_TOKEN", igUserId: "1784", imageUrl },
    });
    expect(result).toMatchObject({ remoteId: "igmedia" });
    const createBody = new URLSearchParams(String(fetch.mock.calls[0][1].body));
    expect(createBody.get("image_url")).toBe(imageUrl);
    expect(createBody.get("caption")).toBe("hello");
  });

  it("Threads caption+image uses IMAGE + image_url, not TEXT-only", async () => {
    const fetch = spyFetch();
    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "container" }), text: async () => JSON.stringify({ id: "container" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: "FINISHED" }), text: async () => "" })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "th1" }), text: async () => JSON.stringify({ id: "th1" }) });
    const result = await adapters.threads.publish({
      ...pending,
      token: "TH_TOKEN",
      credentials: { accessToken: "TH_TOKEN", threadsUserId: "99", imageUrl },
    });
    expect(result).toMatchObject({ remoteId: "th1" });
    const createUrl = new URL(String(fetch.mock.calls[0][0]));
    expect(createUrl.searchParams.get("media_type")).toBe("IMAGE");
    expect(createUrl.searchParams.get("image_url")).toBe(imageUrl);
    expect(createUrl.searchParams.get("text")).toBe("hello");
    const publishUrl = new URL(String(fetch.mock.calls[2][0]));
    expect(publishUrl.searchParams.get("creation_id")).toBe("container");
  });

  it("Threads permission errors explain tester/app-review setup", async () => {
    const fetch = spyFetch();
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({
          error: {
            message:
              "This action requires the threads_basic permission. You must submit for app review, or your user must be in the list of Threads testers.",
          },
        }),
    });
    const result = await adapters.threads.publish({
      ...pending,
      token: "TH_TOKEN",
      credentials: { accessToken: "TH_TOKEN", threadsUserId: "99" },
    });
    expect(result).toMatchObject({ queued: true });
    expect(String("reason" in result ? result.reason : "")).toMatch(/Threads Tester/i);
  });

  it("X uploads the image and attaches media_ids on the tweet", async () => {
    const fetch = spyFetch();
    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { id: "media99" } }), text: async () => "" })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}), text: async () => "" })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}), text: async () => "" })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { id: "tw1" } }), text: async () => "" });
    const result = await adapters.x.publish({
      ...pending,
      token: "x-token",
      credentials: { accessToken: "x-token" },
      imageBytes: jpeg,
      imageContentType: "image/jpeg",
    });
    expect(result).toMatchObject({ remoteId: "tw1" });
    expect(String(fetch.mock.calls[0][0])).toBe("https://api.x.com/2/media/upload/initialize");
    expect(String(fetch.mock.calls[1][0])).toBe("https://api.x.com/2/media/upload/media99/append");
    expect(fetch.mock.calls[1][1].body).toBeInstanceOf(FormData);
    const tweet = JSON.parse(String(fetch.mock.calls[3][1].body));
    expect(tweet.text).toBe("hello");
    expect(tweet.media.media_ids).toEqual(["media99"]);
  });

  it("X queues instead of tweeting caption-only when media upload fails", async () => {
    const fetch = spyFetch();
    fetch.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}), text: async () => "media.write required" });
    const result = await adapters.x.publish({
      ...pending,
      token: "x-token",
      credentials: { accessToken: "x-token", imageUrl },
      imageBytes: jpeg,
      imageContentType: "image/jpeg",
    });
    expect(result).toMatchObject({ queued: true });
    expect(String("reason" in result ? result.reason : "")).toMatch(/media upload failed/i);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("LinkedIn initializes an image upload and attaches the urn, not commentary-only", async () => {
    const fetch = spyFetch();
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: { uploadUrl: "https://www.linkedin.com/dms-uploads/1", image: "urn:li:image:abc" } }),
        text: async () => "",
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}), text: async () => "" })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: (h: string) => (h.toLowerCase() === "x-restli-id" ? "urn:li:share:img" : null) },
        json: async () => ({}),
        text: async () => "",
      });
    const result = await adapters.linkedin.publish({
      ...pending,
      token: "li-token",
      credentials: { accessToken: "li-token", authorUrn: "urn:li:person:abc" },
      imageBytes: jpeg,
      imageContentType: "image/jpeg",
    });
    expect(result).toMatchObject({ remoteId: "urn:li:share:img" });
    expect(String(fetch.mock.calls[0][0])).toContain("/rest/images?action=initializeUpload");
    expect(String(fetch.mock.calls[1][0])).toBe("https://www.linkedin.com/dms-uploads/1");
    const post = JSON.parse(String(fetch.mock.calls[2][1].body));
    expect(post.commentary).toBe("hello");
    expect(post.content.media.id).toBe("urn:li:image:abc");
  });

  it("LinkedIn queues instead of posting commentary-only when image init fails", async () => {
    const fetch = spyFetch();
    fetch.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}), text: async () => "forbidden" });
    const result = await adapters.linkedin.publish({
      ...pending,
      token: "li-token",
      credentials: { accessToken: "li-token", authorUrn: "urn:li:person:abc", imageUrl },
      imageBytes: jpeg,
    });
    expect(result).toMatchObject({ queued: true });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("Telegram sendPhoto includes the public url, not sendMessage text-only", async () => {
    const fetch = spyFetch();
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ result: { message_id: 7 } }), text: async () => "" });
    const result = await adapters.telegram.publish({
      ...pending,
      token: "bot",
      credentials: { botToken: "bot", chatId: "c1", imageUrl },
    });
    expect(result).toMatchObject({ remoteId: "7" });
    expect(String(fetch.mock.calls[0][0])).toContain("/sendPhoto");
    expect(String(fetch.mock.calls[0][0])).not.toContain("/sendMessage");
    const body = JSON.parse(String(fetch.mock.calls[0][1].body));
    expect(body.photo).toBe(imageUrl);
    expect(body.caption).toBe("hello");
  });

  it("Discord webhook embeds the image url", async () => {
    const fetch = spyFetch();
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}), text: async () => "" });
    const result = await adapters.discord.publish({
      ...pending,
      token: "https://discord.com/api/webhooks/1/abc",
      credentials: { webhookUrl: "https://discord.com/api/webhooks/1/abc", imageUrl },
    });
    expect("remoteId" in result).toBe(true);
    const body = JSON.parse(String(fetch.mock.calls[0][1].body));
    expect(body.content).toBe("hello");
    expect(body.embeds[0].image.url).toBe(imageUrl);
  });

  it("Slack chat.postMessage includes an image block", async () => {
    const fetch = spyFetch();
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, ts: "1.2" }), text: async () => "" });
    const result = await adapters.slack.publish({
      ...pending,
      token: "xoxb-real-token",
      credentials: { botToken: "xoxb-real-token", channelId: "C123", imageUrl },
    });
    expect(result).toMatchObject({ remoteId: "1.2" });
    const body = JSON.parse(String(fetch.mock.calls[0][1].body));
    expect(body.blocks.some((b: { type: string; image_url?: string }) => b.type === "image" && b.image_url === imageUrl)).toBe(true);
  });

  it("Reddit uploads an image and submits kind=image", async () => {
    const fetch = spyFetch();
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          args: { action: "//reddit-uploaded.s3.amazonaws.com/", fields: [{ name: "key", value: "abc" }] },
        }),
        text: async () => "",
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        text: async () => "<Location>https://reddit.com/media/abc</Location>",
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ json: { data: { name: "t3_img" } } }),
        text: async () => "",
      });
    const result = await adapters.reddit.publish({
      ...pending,
      token: "reddit-token",
      credentials: { accessToken: "reddit-token", subreddit: "duskly", imageUrl },
      imageBytes: jpeg,
      imageContentType: "image/jpeg",
    });
    expect(result).toMatchObject({ remoteId: "t3_img" });
    const submit = new URLSearchParams(String(fetch.mock.calls[2][1].body));
    expect(submit.get("kind")).toBe("image");
    expect(submit.get("url")).toBe("https://reddit.com/media/abc");
  });
});
