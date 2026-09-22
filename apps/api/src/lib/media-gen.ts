import { BASE_WEBM } from "./webm-base";

/** Real playable WebM (VP8) for product UI; prompt/duration stored in media meta. */
export function makePromptWebm(_prompt: string, _durationSec: number): Uint8Array {
  return new Uint8Array(BASE_WEBM);
}

export function makePosterSvg(prompt: string, overlay = ""): string {
  const title = prompt.replace(/[<>&]/g, "").slice(0, 60) || "Generated";
  const sub = overlay.replace(/[<>&]/g, "").slice(0, 40);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f7f5f1"/>
      <stop offset="100%" stop-color="#ffe8e0"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1080" fill="url(#bg)"/>
  <rect x="64" y="64" width="952" height="952" rx="24" fill="none" stroke="#ff5c33" stroke-width="6"/>
  <text x="540" y="500" text-anchor="middle" font-family="Georgia,serif" font-size="48" fill="#18181b">${title}</text>
  ${sub ? `<text x="540" y="580" text-anchor="middle" font-family="system-ui,sans-serif" font-size="28" fill="#52525b">${sub}</text>` : ""}
  <text x="540" y="980" text-anchor="middle" font-family="system-ui,sans-serif" font-size="20" fill="#a1a1aa">Duskly</text>
</svg>`;
}
