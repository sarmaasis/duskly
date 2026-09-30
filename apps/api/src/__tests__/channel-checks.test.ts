import { describe, expect, it } from "vitest";
import { channelIssues, imageSize } from "../../../web/src/app/lib/channel-checks";

function png(width: number, height: number) {
  const bytes = new Uint8Array(32);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes.buffer;
}

describe("channel checks", () => {
  it("reads a PNG size", () => {
    expect(imageSize(png(1080, 1920))).toEqual({ width: 1080, height: 1920 });
  });

  it("blocks an Instagram feed photo that is taller than 4:5", () => {
    const issues = channelIssues({
      network: "instagram",
      body: "Launch",
      media: [{ kind: "image", contentType: "image/jpeg", bytes: 200_000, width: 1080, height: 1920 }],
    });
    expect(issues.some((issue) => issue.includes("4:5"))).toBe(true);
  });

  it("allows a square Instagram photo and a normal LinkedIn text post", () => {
    expect(
      channelIssues({
        network: "instagram",
        body: "Launch",
        media: [{ kind: "image", contentType: "image/jpeg", bytes: 200_000, width: 1080, height: 1080 }],
      }),
    ).toEqual([]);
    expect(channelIssues({ network: "linkedin", body: "Launch", media: [] })).toEqual([]);
  });

  it("blocks the other channels on the limits they actually enforce", () => {
    expect(channelIssues({ network: "x", body: "x".repeat(281), media: [] }).join(" ")).toContain("280");
    expect(channelIssues({ network: "threads", body: "t".repeat(501), media: [] }).join(" ")).toContain("500");
    expect(channelIssues({ network: "bluesky", body: "Launch", media: [{ kind: "image", bytes: 1_100_000, contentType: "image/jpeg" }] }).join(" ")).toContain("1 MB");
    expect(channelIssues({ network: "youtube", body: "Launch", media: [] }).join(" ")).toContain("video");
    expect(channelIssues({ network: "youtube", body: "Launch", media: [{ kind: "video", contentType: "video/mp4" }] })).toEqual([]);
    expect(channelIssues({ network: "instagram", body: "Launch", postType: "reel", media: [] }).join(" ")).toContain("Reels");
    expect(channelIssues({ network: "discord", body: "d".repeat(2001), media: [] }).join(" ")).toContain("2,000");
    expect(channelIssues({ network: "slack", body: "s".repeat(4001), media: [] }).join(" ")).toContain("4,000");
    expect(channelIssues({ network: "x", body: "Poll", hasPoll: true, media: [{ kind: "image", contentType: "image/png", width: 800, height: 800 }] }).join(" ")).toContain("poll");
  });
});
