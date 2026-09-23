import { describe, expect, it } from "vitest";
import { PICTURE_EDITOR_FRAME_MAX, pictureEditorFrameRects } from "../../../web/src/app/lib/picture-editor";

describe("picture-editor aspect math", () => {
  const square = { width: 1000, height: 1000 };
  const landscape = { width: 1920, height: 1080 };
  const portrait = { width: 800, height: 1200 };

  it("1:1 from a square is the full source, framed to MAX×MAX", () => {
    const r = pictureEditorFrameRects(square, "1:1", 0);
    expect(r.sx).toBe(0);
    expect(r.sy).toBe(0);
    expect(r.sw).toBe(1000);
    expect(r.sh).toBe(1000);
    expect(r.dw).toBe(PICTURE_EDITOR_FRAME_MAX);
    expect(r.dh).toBe(PICTURE_EDITOR_FRAME_MAX);
  });

  it("1:1 from landscape center-crops the sides", () => {
    const r = pictureEditorFrameRects(landscape, "1:1", 0);
    expect(r.sh).toBe(1080);
    expect(r.sw).toBe(1080);
    expect(r.sx).toBe((1920 - 1080) / 2);
    expect(r.sy).toBe(0);
    expect(r.dw).toBe(PICTURE_EDITOR_FRAME_MAX);
    expect(r.dh).toBe(PICTURE_EDITOR_FRAME_MAX);
  });

  it("4:5 is taller than wide and uses height as the contain axis", () => {
    const r = pictureEditorFrameRects(portrait, "4:5", 0);
    expect(r.dw / r.dh).toBeCloseTo(4 / 5, 5);
    expect(r.dh).toBe(PICTURE_EDITOR_FRAME_MAX);
    expect(r.dw).toBe(Math.round(PICTURE_EDITOR_FRAME_MAX * (4 / 5)));
  });

  it("16:9 from landscape keeps the wide frame", () => {
    const r = pictureEditorFrameRects(landscape, "16:9", 0);
    expect(r.dw).toBe(PICTURE_EDITOR_FRAME_MAX);
    expect(r.dh).toBe(Math.round(PICTURE_EDITOR_FRAME_MAX / (16 / 9)));
    expect(r.sw / r.sh).toBeCloseTo(16 / 9, 5);
  });

  it("original uses the source aspect and does not stretch", () => {
    const r = pictureEditorFrameRects(landscape, "original", 0);
    expect(r.sx).toBe(0);
    expect(r.sy).toBe(0);
    expect(r.sw).toBe(1920);
    expect(r.sh).toBe(1080);
    expect(r.dw / r.dh).toBeCloseTo(1920 / 1080, 2);
  });

  it("crop percent insets the source box before covering", () => {
    const r = pictureEditorFrameRects(square, "1:1", 10);
    expect(r.sx).toBe(100);
    expect(r.sy).toBe(100);
    expect(r.sw).toBe(800);
    expect(r.sh).toBe(800);
  });
});
