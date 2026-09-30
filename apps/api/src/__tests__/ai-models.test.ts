import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_AI_COPILOT_MODEL,
  DEFAULT_AI_IMAGE_MODEL,
  DEFAULT_AI_VIDEO_MODEL,
  CLIP_DURATION_SEC,
  VIDEO_DURATION_OPTIONS,
  aiCopilotModel,
  aiImageModel,
  aiVideoModel,
  clipMinutesToCharge,
  generateCopilotDraft,
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
    expect(DEFAULT_AI_COPILOT_MODEL).toBe("@cf/meta/llama-3.1-8b-instruct-fast");
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

  it("snaps video duration to short credit-safe options", () => {
    expect(CLIP_DURATION_SEC).toBe(8);
    expect(VIDEO_DURATION_OPTIONS).toEqual([6, 8]);
    expect(snapVideoDuration(6)).toBe(6);
    expect(snapVideoDuration(7)).toBe(6);
    expect(snapVideoDuration(8)).toBe(8);
    expect(snapVideoDuration(11)).toBe(8);
    expect(snapVideoDuration(20)).toBe(8);
    expect(snapVideoDuration(30)).toBe(8);
    expect(snapVideoDuration(1)).toBe(6);
  });

  it("keeps legacy clip-minute rounding conservative", () => {
    expect(clipMinutesToCharge(30)).toBe(1);
    expect(clipMinutesToCharge(8)).toBe(1);
    expect(clipMinutesToCharge(61)).toBe(2);
  });
});

describe("generateCopilotDraft", () => {
  it("throws when the AI binding is missing — no fake suffix", async () => {
    await expect(generateCopilotDraft(env({}), "hey fam")).rejects.toThrow(/Workers AI binding is not configured/);
  });

  it("throws when AI.run fails and does not invent a caption", async () => {
    const run = vi.fn().mockRejectedValue(new Error("3001: Model not found"));
    await expect(generateCopilotDraft(env({ AI: { run } } as unknown as Env), "hey fam")).rejects.toThrow(
      "3001: Model not found",
    );
  });

  it("throws when the model returns no text", async () => {
    const run = vi.fn().mockResolvedValue({ note: "nope" });
    await expect(generateCopilotDraft(env({ AI: { run } } as unknown as Env), "hey fam")).rejects.toThrow(
      /returned no text/,
    );
  });

  it("returns model text only and uses the configured model id", async () => {
    const run = vi.fn().mockResolvedValue({ response: "  Have a good one, fam.  " });
    const out = await generateCopilotDraft(
      env({ AI: { run }, AI_COPILOT_MODEL: "  @cf/meta/llama-3.1-8b-instruct-fast  " } as unknown as Env),
      "Hey, How is you day fam?",
      "warm",
    );
    expect(out.draft).toBe("Have a good one, fam.");
    expect(out.draft).not.toMatch(/drafted for/);
    expect(out.model).toBe("@cf/meta/llama-3.1-8b-instruct-fast");
    expect(run).toHaveBeenCalledOnce();
    expect(run.mock.calls[0][0]).toBe("@cf/meta/llama-3.1-8b-instruct-fast");
    expect(run.mock.calls[0][1]).toEqual({
      messages: [
        {
          role: "system",
          content:
            "You write short social media posts. Return only the post text, no quotes or preamble. Keep under 280 characters unless asked otherwise.",
        },
        {
          role: "user",
          content: "Tone: warm. Draft a post about: Hey, How is you day fam?",
        },
      ],
    });
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
      8,
    );
    expect(out.model).toBe("lightricks/custom");
    expect(out.durationSec).toBe(8);
    expect(out.contentType).toBe("video/mp4");
    expect(out.bytes.byteLength).toBe(4);
    expect(run.mock.calls[0][0]).toBe("lightricks/custom");
    expect(run.mock.calls[0][1]).toMatchObject({ duration: 8 });
  });
});

describe("AI copilot route charging order", () => {
  it("charges quota only after generateCopilotDraft succeeds; failure path says no charge", () => {
    const src = readFileSync(join(here, "../routes/ai.ts"), "utf8");
    const start = src.indexOf('aiRoutes.post("/copilot"');
    const end = src.indexOf('aiRoutes.post("/image"');
    const copilot = src.slice(start, end === -1 ? undefined : end);
    const failAt = copilot.indexOf("copilot_generation_failed");
    const consume = copilot.indexOf('consumeQuota(c.env, body.workspaceId, "aiCopilot"');
    expect(start).toBeGreaterThan(-1);
    expect(failAt).toBeGreaterThan(-1);
    expect(consume).toBeGreaterThan(failAt);
    expect(copilot).toContain("No quota was charged");
    expect(copilot).toContain("generateCopilotDraft");
    expect(copilot).not.toMatch(/drafted for/);
    expect(copilot).not.toContain("body.prompt.trim()");
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
    expect(videoStart).toBeGreaterThan(-1);
    expect(failAt).toBeGreaterThan(-1);
    expect(consumeVideos).toBeGreaterThan(failAt);
    expect(video).toContain("No quota was charged");
    expect(video).not.toMatch(/makePosterSvg|BASE_WEBM|slideshow/i);
    expect(video).toContain("generateTextToVideo");
    expect(video).not.toContain('"aiClipMinutes"');
    expect(video).toContain("CLIP_DURATION_SEC");
  });
});
