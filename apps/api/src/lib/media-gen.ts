/** Lightweight SVG poster for AI image fallbacks / picture editor. */
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
