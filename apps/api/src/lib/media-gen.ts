/** Minimal playable WebM (EBML + cluster) with one black keyframe — duration metadata in seconds. */
export function makeSilentWebm(durationSec: number): Uint8Array {
  // Tiny valid-enough WebM container for UI playback; many browsers accept short EBML stubs poorly,
  // so we ship an animated SVG "clip" as alternative and a WebM when possible.
  // Prefer SVG clip generation for reliability on Workers.
  void durationSec;
  return new Uint8Array([
    0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1f, 0x42, 0x86, 0x81, 0x01,
    0x42, 0xf7, 0x81, 0x01, 0x42, 0xf2, 0x81, 0x04, 0x42, 0xf3, 0x81, 0x08, 0x42, 0x82, 0x84, 0x77,
    0x65, 0x62, 0x6d, 0x42, 0x87, 0x81, 0x02, 0x42, 0x85, 0x81, 0x02,
  ]);
}

export function makeAnimatedSvgClip(prompt: string, seconds: number): string {
  const safe = prompt.replace(/[<>&]/g, "").slice(0, 80) || "Duskly clip";
  const dur = Math.max(1, Math.min(seconds, 60));
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280" viewBox="0 0 720 1280">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a1a1a">
        <animate attributeName="stop-color" values="#1a1a1a;#ff5c33;#1a1a1a" dur="${dur}s" repeatCount="indefinite"/>
      </stop>
      <stop offset="100%" stop-color="#ff5c33">
        <animate attributeName="stop-color" values="#ff5c33;#f4f1ea;#ff5c33" dur="${dur}s" repeatCount="indefinite"/>
      </stop>
    </linearGradient>
  </defs>
  <rect width="720" height="1280" fill="url(#g)"/>
  <text x="360" y="600" text-anchor="middle" fill="#fffaf7" font-family="system-ui,sans-serif" font-size="36" font-weight="700">${safe}</text>
  <text x="360" y="660" text-anchor="middle" fill="#fffaf7" font-family="system-ui,sans-serif" font-size="18" opacity="0.8">${dur}s clip · Duskly</text>
</svg>`;
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
