export function pageArgs(limitRaw?: string, offsetRaw?: string, fallback = 50, max = 100) {
  const n = Number(limitRaw);
  const limit = Number.isInteger(n) && n > 0 ? Math.min(n, max) : fallback;
  const off = Number(offsetRaw);
  const offset = Number.isInteger(off) && off > 0 ? off : 0;
  return { limit, offset };
}

export function pageNext<T>(rows: T[], limit: number, offset: number) {
  const more = rows.length > limit;
  return { rows: more ? rows.slice(0, limit) : rows, next: more ? offset + limit : null };
}
