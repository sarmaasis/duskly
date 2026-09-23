import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_AI_COPILOT_MODEL,
  DEFAULT_AI_IMAGE_MODEL,
  DEFAULT_AI_VIDEO_MODEL,
  VIDEO_DURATION_OPTIONS,
  aiCopilotModel,
  aiImageModel,
  aiVideoModel,
  generateTextToVideo,
  snapVideoDuration,
} from "../lib/ai-models";
import type { Env } from "../env";

const here = dirname(fileURLToPath(import.meta.url));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function env(partial: Partial<Env> = {}): Env {
  return partial as Env;
}

describe("AI model ids", () => {
  it("defaults copilot / image / video when env is empty or whitespace", () => {
    expect(aiCopilotModel(env({}))).toBe(DEFAULT_AI_COPILOT_MODEL);
    expect(aiImageModel(env({}))).toBe(DEFAULT_AI_IMAGE_MODEL);
    expect(aiVideoModel(env({}))).toBe(DEFAULT_AI_VIDEO_MODEL);
    expect(aiCopilotModel(env({ AI_COPILOT_MODEL: "  " }))).toBe(DEFAULT_AI_COPILOT_MODEL);
    expect(aiImageModel(env({ AI_IMAGE_MODEL: "\t" }))).toBe(DEFAULT_AI_IMAGE_MODEL);
    expect(aiVideoModel(env({ AI_VIDEO_MODEL: "" }))).toBe(DEFAULT_AI_VIDEO_MODEL);
  });

  it("uses trimmed env overrides", () => {
    expect(aiCopilotModel(env({ AI_COPILOT_MODEL: "  @cf/custom-llm  " }))).toBe("@cf/custom-llm");
    expect(aiImageModel(env({ AI_IMAGE_MODEL: "flux-pro" }))).toBe("flux-pro");
    expect(aiVideoModel(env({ AI_VIDEO_MODEL: " vendor/vid " }))).toBe("vendor/vid");
  });

  it("snaps video duration to even LTX options", () => {
    expect(VIDEO_DURATION_OPTIONS).toEqual([6, 8, 10, 12]);
    expect(snapVideoDuration(6)).toBe(6);
    expect(snapVideoDuration(7)).toBe(6);
    expect(snapVideoDuration(8)).toBe(8);
    expect(snapVideoDuration(11)).toBe(10);
    expect(snapVideoDuration(20)).toBe(12);
    expect(snapVideoDuration(1)).toBe(6);
  });
});

describe("generateTextToVideo", () => {
  it("throws when the AI binding is missing — no fake slideshow bytes", async () => {
    await expect(generateTextToVideo(env({}), "sunset", 8)).rejects.toThrow(/Workers AI binding is not configured/);
  });

  it("throws when the model returns no video URL — does not invent a clip", async () => {
    const run = vi.fn().mockResolvedValue({ note: "nope" });
    await expect(generateTextToVideo(env({ AI: { run } } as unknown as Env), "cats", 8)).rejects.toThrow(
      /returned no video URL/,
    );
    expect(run).toHaveBeenCalledOnce();
    const [model] = run.mock.calls[0];
    expect(model).toBe(DEFAULT_AI_VIDEO_MODEL);
  });

  it("throws when AI.run fails and does not return bytes", async () => {
    const run = vi.fn().mockRejectedValue(new Error("model offline"));
    await expect(generateTextToVideo(env({ AI: { run } } as unknown as Env), "dogs", 8)).rejects.toThrow("model offline");
  });

  it("throws when the download is empty", async () => {
    const run = vi.fn().mockResolvedValue({ video: "https://cdn.example/clip.mp4" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(0),
        headers: new Headers({ "content-type": "video/mp4" }),
      }),
    );
    await expect(generateTextToVideo(env({ AI: { run } } as unknown as Env), "rain", 8)).rejects.toThrow(
      /Generated video was empty/,
    );
  });

  it("returns env model id and real bytes on success", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const run = vi.fn().mockResolvedValue({ video: "https://cdn.example/out.mp4" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => bytes.buffer,
        headers: new Headers({ "content-type": "video/mp4" }),
      }),
    );
    const out = await generateTextToVideo(
      env({ AI: { run }, AI_VIDEO_MODEL: "lightricks/custom" } as unknown as Env),
      "waves",
      9,
    );
    expect(out.model).toBe("lightricks/custom");
    expect(out.durationSec).toBe(8);
    expect(out.contentType).toBe("video/mp4");
    expect(out.bytes.byteLength).toBe(4);
    expect(run.mock.calls[0][0]).toBe("lightricks/custom");
  });
});

describe("AI video route charging order", () => {
  it("charges quota only after generateTextToVideo succeeds; failure path says no charge", () => {
    const src = readFileSync(join(here, "../routes/ai.ts"), "utf8");
    const videoStart = src.indexOf('aiRoutes.post("/video"');
    const videoEnd = src.indexOf('aiRoutes.post("/agent"');
    const video = src.slice(videoStart, videoEnd === -1 ? undefined : videoEnd);
    const failAt = video.indexOf("video_generation_failed");
    const consumeVideos = video.indexOf('consumeQuota(c.env, body.workspaceId, "aiVideos"');
    const consumeMinutes = video.indexOf('consumeQuota(c.env, body.workspaceId, "aiClipMinutes"');
    expect(videoStart).toBeGreaterThan(-1);
    expect(failAt).toBeGreaterThan(-1);
    expect(consumeVideos).toBeGreaterThan(failAt);
    expect(consumeMinutes).toBeGreaterThan(failAt);
    expect(video).toContain("No quota was charged");
    expect(video).not.toMatch(/makePosterSvg|BASE_WEBM|slideshow/i);
    expect(video).toContain("generateTextToVideo");
  });
});
