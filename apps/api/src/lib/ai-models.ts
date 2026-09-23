import type { Env } from "../env";

export const DEFAULT_AI_COPILOT_MODEL = "@cf/meta/llama-3.1-8b-instruct";
export const DEFAULT_AI_IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";
/** Cloudflare Workers AI text-to-video (Lightricks LTX-2.5 Fast). */
export const DEFAULT_AI_VIDEO_MODEL = "lightricks/ltx-2-5-fast";

export function aiCopilotModel(env: Env): string {
  return env.AI_COPILOT_MODEL?.trim() || DEFAULT_AI_COPILOT_MODEL;
}

export function aiImageModel(env: Env): string {
  return env.AI_IMAGE_MODEL?.trim() || DEFAULT_AI_IMAGE_MODEL;
}

export function aiVideoModel(env: Env): string {
  return env.AI_VIDEO_MODEL?.trim() || DEFAULT_AI_VIDEO_MODEL;
}

/** LTX-2.5 Fast allows even durations from 6–20s at 24fps 720p/1080p. */
export const VIDEO_DURATION_OPTIONS = [6, 8, 10, 12] as const;
export type VideoDurationSec = (typeof VIDEO_DURATION_OPTIONS)[number];

export function snapVideoDuration(sec: number): VideoDurationSec {
  const allowed = VIDEO_DURATION_OPTIONS;
  let best: VideoDurationSec = allowed[0];
  let dist = Math.abs(sec - best);
  for (const d of allowed) {
    const n = Math.abs(sec - d);
    if (n < dist) {
      best = d;
      dist = n;
    }
  }
  return best;
}

function videoUrlFromResult(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  if (typeof r.video === "string" && r.video.startsWith("http")) return r.video;
  if (r.result && typeof r.result === "object") {
    const inner = r.result as Record<string, unknown>;
    if (typeof inner.video === "string" && inner.video.startsWith("http")) return inner.video;
  }
  return null;
}

/**
 * Run configured text-to-video model; fetch MP4 bytes from the returned URL.
 * Throws Error with a clear message on failure — callers must not charge quota.
 */
export async function generateTextToVideo(
  env: Env,
  prompt: string,
  durationSec: number,
): Promise<{ bytes: Uint8Array; contentType: string; model: string; durationSec: number }> {
  if (!env.AI) {
    throw new Error("Workers AI binding is not configured");
  }
  const duration = snapVideoDuration(durationSec);
  const model = aiVideoModel(env);
  let result: unknown;
  try {
    // LTX model id may not yet be in generated AiModels typings.
    result = await env.AI.run(model as never, {
      prompt: prompt.slice(0, 2000),
      duration,
      resolution: "1280x720",
      fps: 24,
      generate_audio: true,
    });
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : `AI.run failed for ${model}`);
  }

  const url = videoUrlFromResult(result);
  if (!url) {
    throw new Error(`Text-to-video model ${model} returned no video URL`);
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download generated video (${res.status})`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  if (!buf.byteLength) {
    throw new Error("Generated video was empty");
  }
  const contentType = res.headers.get("content-type")?.split(";")[0] || "video/mp4";
  return { bytes: buf, contentType, model, durationSec: duration };
}
