export function nextSlotMs(slots: string[], fromMs: number, takenMs: number[] = []) {
  const minutes = slots
    .map((slot) => {
      const match = /^(\d{1,2}):(\d{2})$/.exec(slot.trim());
      if (!match) return null;
      const hour = Number(match[1]);
      const minute = Number(match[2]);
      if (hour > 23 || minute > 59) return null;
      return hour * 60 + minute;
    })
    .filter((value): value is number => value != null)
    .sort((a, b) => a - b);
  if (!minutes.length) return null;
  const start = new Date(fromMs);
  for (let day = 0; day < 14; day++) {
    const base = new Date(start.getFullYear(), start.getMonth(), start.getDate() + day);
    for (const mins of minutes) {
      const at = new Date(base);
      at.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
      const ms = at.getTime();
      if (ms <= fromMs) continue;
      if (takenMs.some((taken) => Math.abs(taken - ms) < 60_000)) continue;
      return ms;
    }
  }
  return null;
}
