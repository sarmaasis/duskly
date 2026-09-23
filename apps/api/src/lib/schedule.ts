/** Daily / weekly follow-ups after the first scheduled time. Caps at 52. */
export function expandRepeatTimes(
  scheduledAtMs: number,
  rule: "daily" | "weekly",
  untilMs: number,
  max = 52,
): number[] {
  const step = rule === "daily" ? 86_400_000 : 604_800_000;
  const times: number[] = [];
  let next = scheduledAtMs + step;
  let n = 0;
  while (next <= untilMs && n < max) {
    times.push(next);
    next += step;
    n += 1;
  }
  return times;
}

export function shouldDeferFirstComment(delaySeconds: number, commentBody?: string | null) {
  return delaySeconds > 0 && !!commentBody?.trim();
}

/** Queue delay for first-comment; Cloudflare Queue delaySeconds is 1–43200. */
export function commentQueueDelay(delaySeconds: number) {
  return Math.min(Math.max(1, delaySeconds), 43200);
}

export function rssHasPublishTarget(channelIds: string[], groupId?: string | null) {
  return channelIds.length > 0 || Boolean(groupId);
}

export function mergeRssChannelIds(channelIds: string[], groupMemberIds: string[]) {
  return [...new Set([...channelIds, ...groupMemberIds])];
}
