export const PICTURE_EDITOR_FRAME_MAX = 640;

export type AspectPreset = "original" | "1:1" | "4:5" | "16:9";

/** Source cover-rect + dest frame (same aspect → no stretch). */
export function pictureEditorFrameRects(
  img: { width: number; height: number },
  aspectPreset: AspectPreset,
  cropPct: number,
  max = PICTURE_EDITOR_FRAME_MAX,
): { sx: number; sy: number; sw: number; sh: number; dw: number; dh: number } {
  const inset = cropPct / 100;
  const baseX = img.width * inset;
  const baseY = img.height * inset;
  const baseW = img.width * (1 - 2 * inset);
  const baseH = img.height * (1 - 2 * inset);
  const targetAspect =
    aspectPreset === "1:1"
      ? 1
      : aspectPreset === "4:5"
        ? 4 / 5
        : aspectPreset === "16:9"
          ? 16 / 9
          : baseW / Math.max(baseH, 1);

  let sw: number;
  let sh: number;
  let sx: number;
  let sy: number;
  if (baseW / baseH > targetAspect) {
    sh = baseH;
    sw = baseH * targetAspect;
    sx = baseX + (baseW - sw) / 2;
    sy = baseY;
  } else {
    sw = baseW;
    sh = baseW / targetAspect;
    sx = baseX;
    sy = baseY + (baseH - sh) / 2;
  }

  let dw: number;
  let dh: number;
  if (targetAspect >= 1) {
    dw = max;
    dh = Math.max(1, Math.round(max / targetAspect));
  } else {
    dh = max;
    dw = Math.max(1, Math.round(max * targetAspect));
  }
  return { sx, sy, sw, sh, dw, dh };
}
