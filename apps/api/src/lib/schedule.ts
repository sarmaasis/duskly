/** Daily, weekly, or every-N-days follow-ups after the first scheduled time. Caps at 52. */
export function expandRepeatTimes(
  scheduledAtMs: number,
  rule: "daily" | "weekly" | "interval",
  untilMs: number,
  max = 52,
  everyDays = 1,
): number[] {
  const days = rule === "weekly" ? 7 : rule === "interval" ? Math.max(1, Math.min(90, everyDays)) : 1;
  const step = days * 86_400_000;
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

export function scheduleStatus(role: string, requested: "draft" | "scheduled") {
  if (requested === "scheduled" && role === "member") return "pending_approval" as const;
  return requested;
}

/** Replace http(s) URLs with /v1/go/:code links. Same URL reuses one code. */
export function rewriteShortLinks(body: string, origin: string) {
  const pairs: { code: string; url: string }[] = [];
  const next = body.replace(/https?:\/\/[^\s)]+/g, (url) => {
    let code = pairs.find((pair) => pair.url === url)?.code;
    if (!code) {
      code = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
      pairs.push({ code, url });
    }
    return `${origin.replace(/\/$/, "")}/v1/go/${code}`;
  });
  return { body: next, pairs };
}

export function pickMetrics(raw: Record<string, unknown>) {
  const out: { likes?: number; comments?: number; reach?: number } = {};
  for (const key of ["likes", "comments", "reach"] as const) {
    const n = raw[key];
    if (typeof n === "number" && Number.isFinite(n)) out[key] = n;
  }
  return Object.keys(out).length ? out : null;
}
