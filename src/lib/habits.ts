export type HabitWithStatus = {
  id: string;
  name: string;
  description: string | null;
  archived: boolean;
  createdAt: Date;
  doneToday: boolean;
  streak: number;
};

/**
 * Current completion streak ending `today`. If today is not yet completed the
 * count starts from yesterday (an ongoing streak that hasn't been logged for
 * the current day still counts).
 */
export function computeStreak(doneKeys: Set<string>, today: string): number {
  let streak = 0;
  let cursor = today;
  if (!doneKeys.has(cursor)) {
    cursor = previousDayKey(cursor);
    if (!doneKeys.has(cursor)) return streak; // no streak at all
  }
  while (doneKeys.has(cursor)) {
    streak += 1;
    cursor = previousDayKey(cursor);
  }
  return streak;
}

function previousDayKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  dt.setDate(dt.getDate() - 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
    dt.getDate(),
  ).padStart(2, "0")}`;
}