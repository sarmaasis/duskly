import { describe, expect, it } from "vitest";
import { CAPTION_LIMITS, countCaptionChars, countHashtags } from "../../../web/src/app/lib/caption-limits";

describe("caption limits", () => {
  it("covers the five public networks with the documented caps", () => {
    const byId = Object.fromEntries(CAPTION_LIMITS.map((n) => [n.id, n]));
    expect(byId.x.limit).toBe(280);
    expect(byId.threads.limit).toBe(500);
    expect(byId.instagram.limit).toBe(2200);
    expect(byId.facebook.limit).toBe(500);
    expect(byId.facebook.hardLimit).toBe(63206);
    expect(byId.linkedin.limit).toBe(3000);
  });

  it("counts code points so emoji is one character", () => {
    expect(countCaptionChars("hi")).toBe(2);
    expect(countCaptionChars("hi🎉")).toBe(3);
  });

  it("counts hashtags and ignores leftover hashes", () => {
    expect(countHashtags("none here")).toBe(0);
    expect(countHashtags("Launch #duskly on #x today #")).toBe(2);
  });
});
