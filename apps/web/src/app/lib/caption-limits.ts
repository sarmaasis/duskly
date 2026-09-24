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
];

/** Code-point length so emoji count as one character. */
export function countCaptionChars(text: string): number {
  return [...text].length;
}

export function countHashtags(text: string): number {
  return text.match(/#[^\s#]+/g)?.length ?? 0;
}
