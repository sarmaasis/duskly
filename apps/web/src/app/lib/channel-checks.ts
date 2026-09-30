import { countCaptionChars, countHashtags } from "./caption-limits";

export type ChannelMedia = {
  kind: "image" | "video";
  contentType?: string;
  bytes?: number;
  width?: number;
  height?: number;
  durationSec?: number;
};

export type ChannelCheck = {
  network: string;
  body: string;
  postType?: string;
  hasPoll?: boolean;
  media: ChannelMedia[];
};

const MB = 1024 * 1024;

const LABEL: Record<string, string> = {
  x: "X",
  threads: "Threads",
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  "linkedin-page": "LinkedIn",
  bluesky: "Bluesky",
  mastodon: "Mastodon",
  youtube: "YouTube",
  reddit: "Reddit",
  telegram: "Telegram",
  discord: "Discord",
  slack: "Slack",
  hashnode: "Hashnode",
  devto: "dev.to",
};

function label(network: string) {
  return LABEL[network] || "This channel";
}

function textLimit(network: string, hasImage: boolean) {
  if (network === "telegram" && hasImage) return 1024;
  const limits: Record<string, number> = {
    x: 280,
    threads: 500,
    instagram: 2200,
    facebook: 63206,
    linkedin: 3000,
    "linkedin-page": 3000,
    bluesky: 300,
    mastodon: 500,
    youtube: 5000,
    reddit: 40000,
    telegram: 4096,
    discord: 2000,
    slack: 4000,
  };
  return limits[network] ?? 0;
}

function publishesManyImages(network: string) {
  return network === "linkedin" || network === "linkedin-page";
}

function allowed(type: string | undefined, types: string[]) {
  if (!type) return true;
  const normalized = type === "image/jpg" ? "image/jpeg" : type;
  return types.includes(normalized);
}

function imageRules(images: ChannelMedia[], types: string[], maxBytes: number, name: string) {
  const issues: string[] = [];
  for (const image of images) {
    if (image.contentType && !allowed(image.contentType, types)) {
      issues.push(`${name} cannot post a ${image.contentType.replace("image/", "").toUpperCase()} file. Use ${types.map((type) => type.replace("image/", "").toUpperCase()).join(" or ")}.`);
    }
    if (image.bytes && image.bytes > maxBytes) {
      issues.push(`${name} cannot post a photo over ${Math.round(maxBytes / MB)} MB.`);
    }
  }
  return issues;
}

function instagram(postType: string, images: ChannelMedia[], videos: ChannelMedia[], text: string) {
  const issues: string[] = [];
  if (postType === "reel") {
    if (!videos.length) issues.push("Instagram Reels need a video.");
    if (videos.some((video) => video.durationSec && (video.durationSec < 3 || video.durationSec > 900))) {
      issues.push("Instagram Reels must be between 3 seconds and 15 minutes.");
    }
    return issues;
  }
  if (postType === "story") {
    if (!images.length && !videos.length) issues.push("Instagram Stories need a photo or a video.");
    return issues;
  }
  if (!images.length) issues.push("Instagram feed posts need an attached image.");
  if (countHashtags(text) > 30) issues.push("Instagram allows 30 hashtags. This post has more.");
  issues.push(...imageRules(images, ["image/jpeg", "image/png"], 8 * MB, "Instagram"));
  for (const image of images) {
    if (!image.width || !image.height) continue;
    const ratio = image.width / image.height;
    if (ratio < 0.8 || ratio > 1.91) {
      issues.push(`Instagram cannot post this photo (${image.width}×${image.height}). Feed photos must be between 4:5 and 1.91:1.`);
    }
  }
  return issues;
}

/** Reasons this post would be rejected or silently dropped by the channel. */
export function channelIssues(input: ChannelCheck): string[] {
  const network = input.network;
  const text = input.body || "";
  const chars = countCaptionChars(text.trim());
  const images = input.media.filter((item) => item.kind === "image");
  const videos = input.media.filter((item) => item.kind === "video");
  const postType = input.postType || "post";
  const issues: string[] = [];
  const limit = textLimit(network, images.length > 0);
  if (limit && chars > limit) {
    issues.push(`${label(network)} allows ${limit.toLocaleString("en-US")} characters. This post is ${chars.toLocaleString("en-US")}.`);
  }
  if (!chars && network !== "instagram") issues.push(`${label(network)} needs post text.`);
  if (images.length > 1 && !publishesManyImages(network)) {
    issues.push(`${label(network)} publishes the first photo only. Extra photos will not be posted.`);
  }
  if (input.hasPoll && images.length && (network === "x" || network === "linkedin" || network === "linkedin-page")) {
    issues.push(`${label(network)} cannot post a poll and a photo together.`);
  }
  if (network === "instagram") issues.push(...instagram(postType, images, videos, text));
  if (network === "youtube" && !videos.length) issues.push("YouTube needs a video file.");
  if (network === "threads") issues.push(...imageRules(images, ["image/jpeg", "image/png"], 8 * MB, "Threads"));
  if (network === "facebook") issues.push(...imageRules(images, ["image/jpeg", "image/png", "image/gif"], 10 * MB, "Facebook"));
  if (network === "x") {
    for (const image of images) {
      const gif = image.contentType === "image/gif";
      issues.push(...imageRules([image], ["image/jpeg", "image/png", "image/gif", "image/webp"], gif ? 15 * MB : 5 * MB, "X"));
    }
  }
  if (network === "linkedin" || network === "linkedin-page") {
    issues.push(...imageRules(images, ["image/jpeg", "image/png", "image/gif"], 8 * MB, "LinkedIn"));
  }
  if (network === "bluesky") issues.push(...imageRules(images, ["image/jpeg", "image/png", "image/gif", "image/webp"], MB, "Bluesky"));
  if (network === "mastodon") issues.push(...imageRules(images, ["image/jpeg", "image/png", "image/gif", "image/webp"], 8 * MB, "Mastodon"));
  if (network === "reddit") issues.push(...imageRules(images, ["image/jpeg", "image/png", "image/gif"], 20 * MB, "Reddit"));
  if (network === "telegram") issues.push(...imageRules(images, ["image/jpeg", "image/png", "image/gif", "image/webp"], 10 * MB, "Telegram"));
  if (network === "discord") issues.push(...imageRules(images, ["image/jpeg", "image/png", "image/gif", "image/webp"], 10 * MB, "Discord"));
  if ((network === "hashnode" || network === "devto") && images.length) {
    issues.push(...imageRules(images, ["image/jpeg", "image/png", "image/gif", "image/webp"], 8 * MB, label(network)));
  }
  return issues;
}

/** PNG, JPEG, GIF, and WebP canvas size. Returns null when the header is missing. */
export function imageSize(bytes: ArrayBuffer): { width: number; height: number } | null {
  const u = new Uint8Array(bytes);
  if (u.length > 24 && u[0] === 0x89 && u[1] === 0x50 && u[2] === 0x4e && u[3] === 0x47) {
    const view = new DataView(bytes);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (u.length > 10 && u[0] === 0x47 && u[1] === 0x49 && u[2] === 0x46) {
    return { width: u[6] | (u[7] << 8), height: u[8] | (u[9] << 8) };
  }
  if (u.length > 30 && u[0] === 0x52 && u[1] === 0x49 && u[8] === 0x57 && u[9] === 0x45 && u[10] === 0x42 && u[11] === 0x50 && u[12] === 0x56 && u[13] === 0x50 && u[14] === 0x38 && u[15] === 0x58) {
    return { width: 1 + (u[24] | (u[25] << 8) | (u[26] << 16)), height: 1 + (u[27] | (u[28] << 8) | (u[29] << 16)) };
  }
  if (u[0] === 0xff && u[1] === 0xd8) {
    let i = 2;
    while (i + 8 < u.length) {
      if (u[i] !== 0xff) break;
      const marker = u[i + 1];
      const len = (u[i + 2] << 8) | u[i + 3];
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
        return { height: (u[i + 5] << 8) | u[i + 6], width: (u[i + 7] << 8) | u[i + 8] };
      }
      if (len < 2) break;
      i += 2 + len;
    }
  }
  return null;
}
