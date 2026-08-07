"use server";

import { and, asc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { habitLogs, habits } from "@/db/schema";
import { computeStreak, type HabitWithStatus } from "@/lib/habits";
import { requireSession } from "@/lib/session";
import { DAY_ROLLOVER_HOUR, todayKey } from "@/lib/time";

export async function listHabits(): Promise<HabitWithStatus[]> {
  const session = await requireSession();
  const day = todayKey(DAY_ROLLOVER_HOUR);

  const rows = await db
    .select()
    .from(habits)
    .where(eq(habits.userId, session.user.id))
    .orderBy(asc(habits.createdAt));

  if (rows.length === 0) return [];

  const logs = await db
    .select({ habitId: habitLogs.habitId, dayKey: habitLogs.dayKey })
    .from(habitLogs)
    .where(inArray(habitLogs.habitId, rows.map((r) => r.id)));

  const byHabit = new Map<string, Set<string>>();
  for (const log of logs) {
    const set = byHabit.get(log.habitId) ?? new Set<string>();
    set.add(log.dayKey);
    byHabit.set(log.habitId, set);
  }

  return rows.map((h) => {
    const doneKeys = byHabit.get(h.id) ?? new Set<string>();
    return {
      id: h.id,
      name: h.name,
      description: h.description,
      archived: h.archived,
      createdAt: h.createdAt,
      doneToday: doneKeys.has(day),
      streak: computeStreak(doneKeys, day),
    };
  });
}

export async function createHabit(name: string, description?: string) {
  const session = await requireSession();
  const n = name.trim();
  if (!n) return;
  await db.insert(habits).values({
    userId: session.user.id,
    name: n,
    description: description?.trim() || null,
  });
  revalidatePath("/habits");
}

export async function deleteHabit(id: string) {
  const session = await requireSession();
  const owns = await db
    .select({ id: habits.id })
    .from(habits)
    .where(and(eq(habits.id, id), eq(habits.userId, session.user.id)));
  if (!owns[0]) return;
  await db.delete(habits).where(eq(habits.id, id));
  revalidatePath("/habits");
}

/**
 * Toggle whether a habit was completed for `dayKey` (defaults to today under
 * the 4am rollover). Returns the new state so the UI can update.
 */
export async function toggleHabit(habitId: string, dayKey?: string) {
  const session = await requireSession();
  const day = dayKey ?? todayKey(DAY_ROLLOVER_HOUR);

  const habit = await db
    .select({ id: habits.id })
    .from(habits)
    .where(and(eq(habits.id, habitId), eq(habits.userId, session.user.id)));
  if (!habit[0]) return { done: false };

  const existing = await db
    .select({ id: habitLogs.id })
    .from(habitLogs)
    .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.dayKey, day)))
    .limit(1);

  if (existing[0]) {
    await db.delete(habitLogs).where(eq(habitLogs.id, existing[0].id));
    revalidatePath("/habits");
    return { done: false };
  }
  await db.insert(habitLogs).values({ habitId, dayKey: day });
  revalidatePath("/habits");
  return { done: true };
}

export type HeatmapEntry = { dayKey: string; count: number };

/** Total completed habits per day over the last `days` days (rollover-aware). */
export async function getHeatmap(days = 91): Promise<HeatmapEntry[]> {
  const session = await requireSession();
  const rolloverStart = Date.now() - (days - 1) * 86_400_000;
  const firstInstant = new Date(
    rolloverStart - DAY_ROLLOVER_HOUR * 3_600_000,
  );
  const startKey = toDayKey(firstInstant);

  const rows = await db
    .select({ dayKey: habitLogs.dayKey })
    .from(habitLogs)
    .innerJoin(habits, eq(habitLogs.habitId, habits.id))
    .where(
      and(
        eq(habits.userId, session.user.id),
        inArray(habits.archived, [false]),
      ),
    );

  const normalized = rows.map((r) => r.dayKey).filter((k) => k > startKey);
  const counts = new Map<string, number>();
  for (const k of normalized) counts.set(k, (counts.get(k) ?? 0) + 1);

  return [...counts.entries()]
    .map(([dayKey, count]) => ({ dayKey, count }))
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey));
}

function toDayKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  // Shift back to calendar-day for the boundary comparison.
  const shifted = new Date(d.getTime() + DAY_ROLLOVER_HOUR * 3_600_000);
  return `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}-${pad(
    shifted.getDate(),
  )}`;
}