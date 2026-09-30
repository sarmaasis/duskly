type Bucket = { reset: number; count: number };

const buckets = new Map<string, Bucket>();

export function takeToken(key: string, limit: number, windowMs: number, now = Date.now()) {
  let bucket = buckets.get(key);
  if (!bucket || bucket.reset <= now) {
    if (buckets.size > 4000) buckets.clear();
    bucket = { reset: now + windowMs, count: 0 };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  const retry = Math.max(1, Math.ceil((bucket.reset - now) / 1000));
  return { ok: bucket.count <= limit, retry };
}

export function clientAddress(header: (name: string) => string | undefined) {
  return header("cf-connecting-ip") || header("x-forwarded-for")?.split(",")[0]?.trim() || "";
}

/** Per-IP ceiling. Requests with no client address (unit tests) are not counted. */
export function limitRequest(path: string, method: string, ip: string) {
  if (!ip || method === "OPTIONS" || path === "/healthz") return null;
  const auth = path.startsWith("/api/auth/");
  const otp = path.includes("/send-verification-otp") || /\/team\/invite\/[^/]+\/identify$/.test(path);
  const limit = otp ? 8 : auth ? 40 : 300;
  const hit = takeToken(`${otp ? "otp" : auth ? "auth" : "api"}:${ip}`, limit, 60_000);
  if (hit.ok) return null;
  return { retry: hit.retry };
}
