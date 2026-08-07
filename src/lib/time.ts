/**
 * Local-time "day" helpers used across the app.
 *
 * The app keys by-local-calendar-day. Habits and the heatmap use a 4am
 * rollover (anything 00:00–04:00 counts as the previous day); the time log's
 * day view uses a midnight boundary (rolloverHour = 0).
 */

/** Rollover hour for habit days / heatmap. Anything before this hour still
 * belongs to the previous calendar day. Adjust here if this changes. */
export const DAY_ROLLOVER_HOUR = 4;

const pad = (n: number) => String(n).padStart(2, "0");

/** e.g. YYYY-MM-DD in the *local* timezone of `d`. */
export function toDayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local instance at the start of `key`, shifted by `rolloverHour` hours.
 * Negative rolloverHour means "start of the previous calendar day at that
 * hour", used to make day-key computation 4am-aware. */
export function dayKeyToInstant(
  key: string,
  rolloverHour: number = 0,
): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, rolloverHour, 0, 0, 0);
}

/** The day key an instant maps to under `rolloverHour`. */
export function instantToDayKey(d: Date, rolloverHour: number = 0): string {
  const shifted = new Date(d.getTime() - rolloverHour * 60 * 60 * 1000);
  return toDayKey(shifted);
}

/** Add `n` days to a day key, returning a new key (rolloverHour respected for
 * boundary math). */
export function shiftDayKey(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0); // noon avoids DST edge cases
  dt.setDate(dt.getDate() + n);
  return toDayKey(dt);
}

export function todayKey(rolloverHour: number = 0): string {
  return instantToDayKey(new Date(), rolloverHour);
}

/** True when `inst` falls on `key` for the given rollover hour. */
export function instantOnDayKey(inst: Date, key: string, rolloverHour: number = 0) {
  return instantToDayKey(inst, rolloverHour) === key;
}

export function parseDayKey(key: string): { year: number; month: number; day: number } {
  const [year, month, day] = key.split("-").map(Number);
  return { year, month, day };
}

/** Monday of the week containing `dayKey` (Monday-first week). */
export function weekStartKey(dayKey: string): string {
  const { year, month, day } = parseDayKey(dayKey);
  const dt = new Date(year, month - 1, day, 12, 0, 0, 0);
  const mondayOffset = (dt.getDay() + 6) % 7;
  dt.setDate(dt.getDate() - mondayOffset);
  return toDayKey(dt);
}

/** Add `n` weeks to a Monday-start week key. */
export function shiftWeekKey(weekStart: string, n: number): string {
  return shiftDayKey(weekStart, n * 7);
}

/** The 7 day keys (Mon–Sun) of the week starting `weekStart`. */
export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => shiftDayKey(weekStart, i));
}