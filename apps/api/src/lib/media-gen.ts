import type { Env } from "../env";
import { BASE_WEBM } from "./webm-base";
import { muxVp8Webm, vp8FromWebp, type WebmFrame } from "./webm-mux";

export function makePosterSvg(prompt: string, overlay = ""): string {
  const title = prompt.replace(/[<>&]/g, "").slice(0, 60) || "Generated";
  const sub = overlay.replace(/[<>&]/g, "").slice(0, 40);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f7f5f1"/>
      <stop offset="100%" stop-color="#ffe8e0"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#bg)"/>
  <rect x="24" y="24" width="592" height="312" rx="16" fill="none" stroke="#ff5c33" stroke-width="4"/>
  <text x="320" y="168" text-anchor="middle" font-family="Georgia,serif" font-size="28" fill="#18181b">${title}</text>
  ${sub ? `<text x="320" y="210" text-anchor="middle" font-family="system-ui,sans-serif" font-size="18" fill="#52525b">${sub}</text>` : ""}
  <text x="320" y="320" text-anchor="middle" font-family="system-ui,sans-serif" font-size="14" fill="#a1a1aa">Duskly</text>
</svg>`;
}

async function svgToVp8(env: Env, svg: string): Promise<Uint8Array | null> {
  try {
    const input = new TextEncoder().encode(svg);
    const res = await env.IMAGES.input(input.buffer as ArrayBuffer)
      .transform({ width: 640, height: 360, fit: "contain" })
      .output({ format: "image/webp" });
    const buf = new Uint8Array(await res.arrayBuffer());
    return vp8FromWebp(buf);
  } catch {
    return null;
  }
}

/** First keyframe VP8 payload from the bundled base clip (fallback when Images is unavailable). */
function baseVp8Keyframe(): Uint8Array {
  // SimpleBlock at offset 480: A3 40 BD 81 00 00 80 [VP8...]
  const start = 487;
  const size = 0xbd - 4;
  return BASE_WEBM.slice(start, start + size);
}

function fallbackWebm(prompt: string, durationSec: number): Uint8Array {
  const durationMs = Math.max(1000, Math.round(durationSec * 1000));
  const title = prompt.trim().slice(0, 80) || "clip";
  const frameCount = Math.min(48, Math.max(2, Math.ceil(durationSec)));
  const vp8 = baseVp8Keyframe();
  const frames: WebmFrame[] = [];
  for (let i = 0; i < frameCount; i++) {
    frames.push({
      ptsMs: Math.round((i * durationMs) / Math.max(1, frameCount - 1)),
      vp8: new Uint8Array(vp8),
    });
  }
  return muxVp8Webm(frames, durationMs, title);
}

/**
 * Playable WebM: duration follows durationSec; frames show the prompt title when Images works.
 * Without Images, remuxes a real VP8 keyframe across the timeline with Title=prompt (not a fixed blob).
 */
export async function makePromptWebm(env: Env, prompt: string, durationSec: number): Promise<Uint8Array> {
  const duration = Math.max(1, Math.min(Math.round(durationSec), 600));
  const durationMs = duration * 1000;
  const frameCount = Math.min(24, Math.max(2, Math.ceil(duration / 5)));
  const title = prompt.trim().slice(0, 60) || "Duskly clip";

  const frames: WebmFrame[] = [];
  for (let i = 0; i < frameCount; i++) {
    const tSec = Math.round((i * duration) / Math.max(1, frameCount - 1));
    const svg = makePosterSvg(title, `${tSec}s / ${duration}s`);
    const vp8 = await svgToVp8(env, svg);
    if (!vp8) break;
    frames.push({ ptsMs: Math.round((i * durationMs) / Math.max(1, frameCount - 1)), vp8 });
  }

  if (frames.length >= 2) return muxVp8Webm(frames, durationMs, title);
  if (frames.length === 1) {
    return muxVp8Webm(
      [
        { ptsMs: 0, vp8: frames[0].vp8 },
        { ptsMs: durationMs, vp8: frames[0].vp8 },
      ],
      durationMs,
      title,
    );
  }
  return fallbackWebm(title, duration);
}
