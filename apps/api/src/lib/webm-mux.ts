/** Minimal EBML / WebM helpers for VP8 keyframe clips (Workers, no ffmpeg). */

function u7(n: number): number[] {
  if (n < 0x7f) return [0x80 | n];
  if (n < 0x3fff) return [0x40 | ((n >> 8) & 0x3f), n & 0xff];
  if (n < 0x1fffff) return [0x20 | ((n >> 16) & 0x1f), (n >> 8) & 0xff, n & 0xff];
  return [0x10 | ((n >> 24) & 0x0f), (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function encodeElement(id: number[], data: Uint8Array): Uint8Array {
  const size = u7(data.byteLength);
  const out = new Uint8Array(id.length + size.length + data.byteLength);
  out.set(id, 0);
  out.set(size, id.length);
  out.set(data, id.length + size.length);
  return out;
}

function encodeElementBytes(id: number[], bytes: number[]): Uint8Array {
  return encodeElement(id, Uint8Array.from(bytes));
}

function concat(parts: Uint8Array[]): Uint8Array {
  const n = parts.reduce((a, p) => a + p.byteLength, 0);
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.byteLength;
  }
  return out;
}

function float64be(v: number): number[] {
  const buf = new ArrayBuffer(8);
  new DataView(buf).setFloat64(0, v, false);
  return [...new Uint8Array(buf)];
}

function uintBe(v: number, bytes: number): number[] {
  const out: number[] = [];
  for (let i = bytes - 1; i >= 0; i--) out.push((v >> (8 * i)) & 0xff);
  return out;
}

/** Extract the VP8 bitstream from a lossy WebP (RIFF). */
export function vp8FromWebp(webp: Uint8Array): Uint8Array | null {
  if (webp.byteLength < 20) return null;
  const tag = String.fromCharCode(webp[0], webp[1], webp[2], webp[3]);
  if (tag !== "RIFF") return null;
  let i = 12;
  while (i + 8 <= webp.byteLength) {
    const four = String.fromCharCode(webp[i], webp[i + 1], webp[i + 2], webp[i + 3]);
    const size = webp[i + 4] | (webp[i + 5] << 8) | (webp[i + 6] << 16) | (webp[i + 7] << 24);
    const start = i + 8;
    const end = Math.min(start + size, webp.byteLength);
    if (four === "VP8 ") return webp.slice(start, end);
    i = start + size + (size & 1);
  }
  return null;
}

export type WebmFrame = { ptsMs: number; vp8: Uint8Array };

/** Build a playable VP8 WebM; durationMs is the Segment Duration. */
export function muxVp8Webm(frames: WebmFrame[], durationMs: number, title: string): Uint8Array {
  if (!frames.length) throw new Error("webm_no_frames");
  const w = 640;
  const h = 360;
  const timescale = 1000;

  const ebml = encodeElement(
    [0x1a, 0x45, 0xdf, 0xa3],
    concat([
      encodeElementBytes([0x42, 0x86], [1]), // EBMLVersion
      encodeElementBytes([0x42, 0xf7], [1]), // EBMLReadVersion
      encodeElementBytes([0x42, 0xf2], [4]), // EBMLMaxIDLength
      encodeElementBytes([0x42, 0xf3], [8]), // EBMLMaxSizeLength
      encodeElement([0x42, 0x82], new TextEncoder().encode("webm")), // DocType
      encodeElementBytes([0x42, 0x87], [2]), // DocTypeVersion
      encodeElementBytes([0x42, 0x85], [2]), // DocTypeReadVersion
    ]),
  );

  const info = encodeElement(
    [0x15, 0x49, 0xa9, 0x66],
    concat([
      encodeElementBytes([0x2a, 0xd7, 0xb1], uintBe(timescale, 4)), // TimestampScale
      encodeElementBytes([0x44, 0x89], float64be(durationMs)), // Duration
      encodeElement([0x4d, 0x80], new TextEncoder().encode("duskly")), // MuxingApp
      encodeElement([0x57, 0x41], new TextEncoder().encode("duskly")), // WritingApp
      encodeElement([0x7b, 0xa9], new TextEncoder().encode(title.slice(0, 120) || "clip")), // Title
    ]),
  );

  const videoTrack = encodeElement(
    [0xae],
    concat([
      encodeElementBytes([0xd7], [1]), // TrackNumber
      encodeElementBytes([0x73, 0xc5], uintBe(1, 4)), // TrackUID
      encodeElementBytes([0x83], [1]), // TrackType = video
      encodeElement([0x86], new TextEncoder().encode("V_VP8")), // CodecID
      encodeElement(
        [0xe0],
        concat([
          encodeElementBytes([0xb0], uintBe(w, 2)), // PixelWidth
          encodeElementBytes([0xba], uintBe(h, 2)), // PixelHeight
        ]),
      ),
    ]),
  );
  const tracks = encodeElement([0x16, 0x54, 0xae, 0x6b], videoTrack);

  const clusters: Uint8Array[] = [];
  for (const frame of frames) {
    // SimpleBlock: track 0x81, timecode uint16, flags keyframe 0x80, payload
    const tc = Math.min(0xffff, Math.max(0, frame.ptsMs));
    const block = new Uint8Array(4 + frame.vp8.byteLength);
    block[0] = 0x81;
    block[1] = (tc >> 8) & 0xff;
    block[2] = tc & 0xff;
    block[3] = 0x80;
    block.set(frame.vp8, 4);
    const cluster = encodeElement(
      [0x1f, 0x43, 0xb6, 0x75],
      concat([
        encodeElementBytes([0xe7], uintBe(frame.ptsMs, 4)), // Timestamp
        encodeElement([0xa3], block), // SimpleBlock
      ]),
    );
    clusters.push(cluster);
  }

  const segment = encodeElement([0x18, 0x53, 0x80, 0x67], concat([info, tracks, ...clusters]));
  return concat([ebml, segment]);
}
