type Entry = { exp: number; value: unknown };

const store = new Map<string, Entry>();
const MAX = 500;

export function cacheGet<T>(key: string): T | undefined {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (hit.exp <= Date.now()) {
    store.delete(key);
    return undefined;
  }
  return hit.value as T;
}

export function cacheSet(key: string, value: unknown, ttlMs: number) {
  if (store.size > MAX) store.clear();
  store.set(key, { exp: Date.now() + ttlMs, value });
}

/** Drop cached reads. A write must call this so the next read sees the new row. */
export function clearReadCache() {
  store.clear();
}
