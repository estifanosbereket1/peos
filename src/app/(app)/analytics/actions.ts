"use server";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  dailyPlanTasks,
  dailyPlans,
  fastingWindows,
  habitLogs,
  habits,
  learningLogs,
  nightReviews,
  timeCategories,
  timeEntries,
  weeklyAnchors,
  weeklyPlans,
} from "@/db/schema";
import { requireSession } from "@/lib/session";
import { shiftDayKey, todayKey, weekDays, weekStartKey } from "@/lib/time";

export type CategoryTime = {
  name: string;
  color: string;
  minutes: number;
};

export type Analytics = {
  weekStart: string;
  weekDaysCovered: number;
  time: {
    totalMinutes: number;
    byCategory: CategoryTime[];
  };
  habits: {
    daysDone: number;
    totalDays: number;
  };
  plan: {
    done: number;
    total: number;
  };
  learning: {
    entries: number;
  };
  fasting: {
    windows: number;
    hours: number;
  };
  reviews: {
    count: number;
    avgEnergy: number | null;
  };
  week: {
    anchors: number;
    anchorsFollowed: number;
  };
  energy: {
    byCategory: { name: string; color: string; avg: number; entries: number }[];
  };
};

export async function getAnalytics(weekStart?: string) {
  const session = await requireSession();
  const start = weekStart && /^\d{4}-\d{2}-\d{2}$/.test(weekStart)
    ? weekStart
    : weekStartKey(todayKey());
  const end = shiftDayKey(start, 7);
  const days = weekDays(start);
  const today = todayKey();

  // Time this week: sum overlapping entries by category.
  const startInst = new Date(`${start}T00:00:00`);
  const endInst = new Date(`${end}T00:00:00`);

  const [catRows, entryRows, habitRows, habitLogRows, planRows, taskRows, learningRows, fastRows, reviewRows, anchorRows] =
    await Promise.all([
      db
        .select({ id: timeCategories.id, name: timeCategories.name, color: timeCategories.color })
        .from(timeCategories)
        .where(eq(timeCategories.userId, session.user.id)),
      db
        .select({
          categoryId: timeEntries.categoryId,
          startAt: timeEntries.startAt,
          endAt: timeEntries.endAt,
          energy: timeEntries.energy,
        })
        .from(timeEntries)
        .where(and(eq(timeEntries.userId, session.user.id))),
      db
        .select({ id: habits.id })
        .from(habits)
        .where(eq(habits.userId, session.user.id)),
      db
        .select({ habitId: habitLogs.habitId, dayKey: habitLogs.dayKey })
        .from(habitLogs)
        .innerJoin(habits, eq(habitLogs.habitId, habits.id))
        .where(eq(habits.userId, session.user.id)),
      db
        .select({ id: dailyPlans.id, dayKey: dailyPlans.dayKey, userId: dailyPlans.userId })
        .from(dailyPlans)
        .where(eq(dailyPlans.userId, session.user.id)),
      db
        .select({
          planId: dailyPlanTasks.dailyPlanId,
          completed: dailyPlanTasks.completed,
        })
        .from(dailyPlanTasks)
        .innerJoin(dailyPlans, eq(dailyPlans.id, dailyPlanTasks.dailyPlanId))
        .where(eq(dailyPlans.userId, session.user.id)),
      db
        .select({ learnDate: learningLogs.learnDate })
        .from(learningLogs)
        .where(eq(learningLogs.userId, session.user.id)),
      db
        .select({ startAt: fastingWindows.startAt, endAt: fastingWindows.endAt })
        .from(fastingWindows)
        .where(eq(fastingWindows.userId, session.user.id)),
      db
        .select({ dayKey: nightReviews.dayKey, energy: nightReviews.energy })
        .from(nightReviews)
        .where(eq(nightReviews.userId, session.user.id)),
      db
        .select({
          weekStart: weeklyPlans.weekStart,
          followThrough: weeklyAnchors.followThrough,
        })
        .from(weeklyAnchors)
        .innerJoin(weeklyPlans, eq(weeklyAnchors.weeklyPlanId, weeklyPlans.id))
        .where(eq(weeklyPlans.userId, session.user.id)),
    ]);

  // ---- Time ----
  const catById = new Map(catRows.map((c) => [c.id, c]));
  const byCategory = new Map<string, number>();
  let totalMinutes = 0;
  for (const e of entryRows) {
    if (e.endAt == null) continue; // ignore live timer
    const s = new Date(e.startAt).getTime();
    const en = new Date(e.endAt).getTime();
    const overlapStart = Math.max(s, startInst.getTime());
    const overlapEnd = Math.min(en, endInst.getTime());
    if (overlapEnd <= overlapStart) continue;
    const minutes = Math.round((overlapEnd - overlapStart) / 60_000);
    if (minutes < 1) continue;
    totalMinutes += minutes;
    const key = e.categoryId ?? "uncategorized";
    byCategory.set(key, (byCategory.get(key) ?? 0) + minutes);
  }
  const timeByCategory: CategoryTime[] = [...byCategory.entries()].map(
    ([id, minutes]) => {
      const cat = catById.get(id);
      return {
        name: cat?.name ?? "Uncategorized",
        color: cat?.color ?? "#8a8f98",
        minutes,
      };
    },
  );
  timeByCategory.sort((a, b) => b.minutes - a.minutes);

  // ---- Habits ----
  const habitIds = new Set(habitRows.map((h) => h.id));
  const doneDays = new Set(
    habitLogRows.filter((l) => habitIds.has(l.habitId)).map((l) => l.dayKey),
  );
  const habitDaysDone = days.filter((d) => d <= today && doneDays.has(d)).length;
  const habitTotalDays = days.filter((d) => d <= today).length;

  // ---- Daily plan ----
  let planDone = 0;
  let planTotal = 0;
  for (const t of taskRows) {
    const planKey = planRows.find((p) => p.id === t.planId)?.dayKey;
    if (!planKey) continue;
    planTotal += 1;
    if (t.completed) planDone += 1;
  }

  // ---- Learning ----
  const learnEntries = learningRows.filter(
    (l) => l.learnDate >= start && l.learnDate < end,
  ).length;

  // ---- Fasting ----
  let fastHours = 0;
  let fastWindows = 0;
  for (const f of fastRows) {
    if (!f.endAt) continue;
    const s = Math.max(new Date(f.startAt).getTime(), startInst.getTime());
    const e = Math.min(new Date(f.endAt).getTime(), endInst.getTime());
    if (e <= s) continue;
    fastHours += (e - s) / 3_600_000;
    fastWindows += 1;
  }

  // ---- Reviews (week-scoped) ----
  const weekReviews = reviewRows.filter(
    (r) => r.dayKey >= start && r.dayKey < end,
  );
  const energies = weekReviews
    .filter((r) => r.energy != null)
    .map((r) => r.energy as number);
const avgEnergy = energies.length
    ? Math.round((energies.reduce((a, b) => a + b, 0) / energies.length) * 10) / 10
    : null;

  // ---- Week anchors (current week) ----
  const weekAnchors = anchorRows.filter((a) => a.weekStart === start);
  const anchorsFollowed = weekAnchors.filter((a) => (a.followThrough ?? "").trim()).length;

  // ---- Energy averages by category (week, per entry rating) ----
  const energyById = new Map<string, { sum: number; count: number }>();
  for (const e of entryRows) {
    if (e.energy == null) continue;
    if (e.endAt == null) continue;
    const s = new Date(e.startAt).getTime();
    const en = new Date(e.endAt).getTime();
    const overlapStart = Math.max(s, startInst.getTime());
    const overlapEnd = Math.min(en, endInst.getTime());
    if (overlapEnd <= overlapStart) continue;
    const key = e.categoryId ?? "uncategorized";
    const cur = energyById.get(key) ?? { sum: 0, count: 0 };
    cur.sum += e.energy;
    cur.count += 1;
    energyById.set(key, cur);
  }
  const energyByCategory = [...energyById.entries()].map(([id, v]) => {
    const cat = catById.get(id);
    return {
      name: cat?.name ?? "Uncategorized",
      color: cat?.color ?? "#8a8f98",
      avg: Math.round((v.sum / v.count) * 10) / 10,
      entries: v.count,
    };
  });
  energyByCategory.sort((a, b) => b.avg - a.avg);

  return {
    weekStart: start,
    weekDaysCovered: habitTotalDays,
    time: { totalMinutes, byCategory: timeByCategory },
    habits: { daysDone: habitDaysDone, totalDays: habitTotalDays },
    plan: { done: planDone, total: planTotal },
    learning: { entries: learnEntries },
    fasting: { windows: fastWindows, hours: Math.round(fastHours * 10) / 10 },
    reviews: { count: weekReviews.length, avgEnergy },
    week: { anchors: weekAnchors.length, anchorsFollowed },
    energy: { byCategory: energyByCategory },
  } satisfies Analytics;
}

export async function getAnalyticsRange(weeks = 8) {
  const today = todayKey();
  const currentStart = weekStartKey(today);
  const out: Analytics[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = shiftDayKey(currentStart, -i * 7);
    out.push(await getAnalytics(ws));
  }
  return out;
}