import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createPost } from "../routes/posts";
import {
  commentQueueDelay,
  expandRepeatTimes,
  mergeRssChannelIds,
  pickMetrics,
  rssHasPublishTarget,
  scheduleStatus,
  shouldDeferFirstComment,
} from "../lib/schedule";
import { nextSlotMs } from "../../../web/src/app/lib/slots";

describe("approvals, slots, and metrics", () => {
  it("keeps a member post pending until an admin approves it", () => {
    expect(scheduleStatus("member", "scheduled")).toBe("pending_approval");
    expect(scheduleStatus("admin", "scheduled")).toBe("scheduled");
    expect(scheduleStatus("member", "draft")).toBe("draft");
  });

  it("fills the next clock slot and skips a taken minute", () => {
    const from = Date.parse("2026-09-24T10:00:00");
    const next = nextSlotMs(["09:00", "13:00", "18:00"], from);
    expect(new Date(next || 0).getHours()).toBe(13);
    const taken = nextSlotMs(["13:00"], from, [Date.parse("2026-09-24T13:00:00")]);
    expect(new Date(taken || 0).getDate()).toBe(25);
  });

  it("drops engagement fields the network did not return", () => {
    expect(pickMetrics({ likes: 3, comments: "nope" })).toEqual({ likes: 3 });
    expect(pickMetrics({ reach: Number.NaN })).toBeNull();
  });
});

describe("repeat series", () => {
  it("emits daily follow-ups up to repeatUntil, excluding the original time", () => {
    const start = Date.parse("2026-09-01T10:00:00Z");
    const until = Date.parse("2026-09-04T10:00:00Z");
    const times = expandRepeatTimes(start, "daily", until);
    expect(times).toEqual([
      Date.parse("2026-09-02T10:00:00Z"),
      Date.parse("2026-09-03T10:00:00Z"),
      Date.parse("2026-09-04T10:00:00Z"),
    ]);
  });

  it("emits weekly follow-ups", () => {
    const start = Date.parse("2026-09-01T10:00:00Z");
    const until = Date.parse("2026-09-22T10:00:00Z");
    expect(expandRepeatTimes(start, "weekly", until)).toHaveLength(3);
  });

  it("caps at 52 occurrences so a far-away until cannot explode", () => {
    const start = Date.now();
    const until = start + 200 * 86_400_000;
    expect(expandRepeatTimes(start, "daily", until)).toHaveLength(52);
  });

  it("needs repeatUntil on the create-post schema when the client sends a rule", () => {
    const parsed = createPost.parse({
      workspaceId: "ws",
      body: "hi",
      destinations: ["ch1"],
      repeatRule: "daily",
      repeatUntil: 1,
      commentDelaySeconds: 30,
      commentBody: "first comment",
    });
    expect(parsed.repeatRule).toBe("daily");
    expect(parsed.commentDelaySeconds).toBe(30);
    expect(() => createPost.parse({ workspaceId: "ws", body: "hi", destinations: ["ch1"], repeatRule: "yearly" })).toThrow();
  });

  it("keeps multiple media ids in order on create", () => {
    const parsed = createPost.parse({
      workspaceId: "ws",
      body: "hi",
      destinations: ["ch1"],
      mediaIds: ["img-1", "clip-2", "img-3"],
    });
    expect(parsed.mediaIds).toEqual(["img-1", "clip-2", "img-3"]);
  });

  it("composer schedules mediaIds and the worker signs a public URL then passes image bytes", () => {
    const composer = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../web/src/app/composer/composer.page.ts"), "utf8");
    expect(composer).toContain("mediaIds: this.attachments().map((a) => a.id)");
    expect(composer).toContain("instagramSelected() && !this.imageAttachments().length");
    const posts = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../routes/posts.ts"), "utf8");
    expect(posts).toContain("mediaIds: body.mediaIds?.length ? JSON.stringify(body.mediaIds) : null");
    expect(posts).toContain("instagram_image_required");
    const publisher = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../index.ts"), "utf8");
    expect(publisher).toContain("signPublicMediaUrl");
    expect(publisher).toContain("firstImage");
    expect(publisher).toContain("imageBytes");
    expect(publisher).toContain("JSON.parse(post.mediaIds)");
  });
});

describe("first-comment delay", () => {
  it("defers only when delay > 0 and comment text exists", () => {
    expect(shouldDeferFirstComment(0, "hi")).toBe(false);
    expect(shouldDeferFirstComment(15, "hi")).toBe(true);
    expect(shouldDeferFirstComment(15, "   ")).toBe(false);
    expect(shouldDeferFirstComment(15, null)).toBe(false);
  });

  it("clamps queue delay to Cloudflare's 1–43200s window", () => {
    expect(commentQueueDelay(0)).toBe(1);
    expect(commentQueueDelay(30)).toBe(30);
    expect(commentQueueDelay(99_999)).toBe(43200);
  });
});

describe("RSS channel selection", () => {
  it("requires a channel or a group — empty both is invalid", () => {
    expect(rssHasPublishTarget([], null)).toBe(false);
    expect(rssHasPublishTarget([], undefined)).toBe(false);
    expect(rssHasPublishTarget(["ch1"], null)).toBe(true);
    expect(rssHasPublishTarget([], "grp1")).toBe(true);
  });

  it("merges explicit channels with group members and de-dupes", () => {
    expect(mergeRssChannelIds(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
    expect(mergeRssChannelIds([], ["g1"])).toEqual(["g1"]);
  });
});

describe("group assign", () => {
  it("clears current members then assigns only workspace-scoped ids", () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../routes/workspace.ts"), "utf8");
    const start = src.indexOf('orgRoutes.put("/groups/:id/accounts"');
    const end = src.indexOf('orgRoutes.delete("/groups/:id/accounts');
    const block = src.slice(start, end === -1 ? undefined : end);
    expect(start).toBeGreaterThan(-1);
    expect(block).toContain("groupId: null");
    expect(block).toContain("eq(socialAccount.groupId, groupId)");
    expect(block).toContain("inArray(socialAccount.id, body.accountIds)");
    expect(block).toContain("eq(socialAccount.workspaceId, body.workspaceId)");
  });
});
