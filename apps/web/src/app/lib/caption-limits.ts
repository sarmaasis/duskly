export type CaptionNetwork = {
  id: string;
  label: string;
  limit: number;
  /** Real platform cap when the shown limit is a practical preview. */
  hardLimit?: number;
};

export const CAPTION_LIMITS: CaptionNetwork[] = [
  { id: "x", label: "X", limit: 280 },
  { id: "threads", label: "Threads", limit: 500 },
  { id: "instagram", label: "Instagram", limit: 2200 },
  { id: "facebook", label: "Facebook", limit: 500, hardLimit: 63206 },
  { id: "linkedin", label: "LinkedIn", limit: 3000 },
  { id: "bluesky", label: "Bluesky", limit: 300 },
  { id: "mastodon", label: "Mastodon", limit: 500 },
  { id: "youtube", label: "YouTube", limit: 5000 },
  { id: "reddit", label: "Reddit", limit: 40000 },
  { id: "telegram", label: "Telegram", limit: 4096 },
  { id: "discord", label: "Discord", limit: 2000 },
  { id: "slack", label: "Slack", limit: 40000 },
  { id: "hashnode", label: "Hashnode", limit: 100000 },
  { id: "devto", label: "dev.to", limit: 100000 },
];

/** Code-point length so emoji count as one character. */
export function countCaptionChars(text: string): number {
  return [...text].length;
}

export function countHashtags(text: string): number {
  return text.match(/#[^\s#]+/g)?.length ?? 0;
}
