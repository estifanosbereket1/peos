"use server";

import { and, eq, gte, lt } from "drizzle-orm";

import { getDayPlan } from "@/app/(app)/plan/actions";
import { getActiveFast } from "@/app/(app)/fasting/actions";
import { getReview } from "@/app/(app)/review/actions";
import { getWeek } from "@/app/(app)/week/actions";
import { listHabits } from "@/app/(app)/habits/actions";
import { db } from "@/db";
import { learningLogs, nightReviews } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { todayKey, weekStartKey } from "@/lib/time";

export type TodaySnapshot = {
  plan: { done: number; total: number };
  habitsDone: number;
  habitsTotal: number;
  learningEntries: number;
  reviewSaved: boolean;
  hasFasting: boolean;
};

export async function getTodaySnapshot(): Promise<TodaySnapshot> {
  const session = await requireSession();
  const day = todayKey();

  const [plan, habits, learning, review, fasting] = await Promise.all([
    getDayPlan(day),
    listHabits(),
    getLearningCount(session.user.id, day, shiftKey(day, 1)),
    getReview(day),
    getActiveFast(),
  ]);

  return {
    plan: {
      done: plan.filter((t) => t.completed).length,
      total: plan.length,
    },
    habitsDone: habits.filter((h) => h.doneToday).length,
    habitsTotal: habits.length,
    learningEntries: learning,
    reviewSaved:
      review?.wins != null ||
      review?.improve != null ||
      review?.nextMove != null,
    hasFasting: fasting != null,
  };
}

export type GrowthSnapshot = {
  anchors: { text: string; followed: boolean }[];
  anchorsReviewed: boolean;
  habitsDone: number;
  learningEntries: number;
  reviews: number;
};

export async function getGrowthSnapshot(): Promise<GrowthSnapshot> {
  const session = await requireSession();
  const day = todayKey();
  const weekStart = weekStartKey(day);

  const [week, habits] = await Promise.all([getWeek(weekStart), listHabits()]);

  return {
    anchors: week.anchors.map((a) => ({
      text: a.text,
      followed: !!a.followThrough,
    })),
    anchorsReviewed: week.reviewed,
    habitsDone: habits.filter((h) => h.streak > 0).length,
    learningEntries: await getLearningCount(session.user.id, weekStart, day),
    reviews: await countReviews(session.user.id, weekStart, day),
  };
}

async function getLearningCount(userId: string, from: string, to: string) {
  const rows = await db
    .select({ learnDate: learningLogs.learnDate })
    .from(learningLogs)
    .where(
      and(
        eq(learningLogs.userId, userId),
        gte(learningLogs.learnDate, from),
        lt(learningLogs.learnDate, to),
      ),
    );
  return rows.length;
}

async function countReviews(userId: string, from: string, to: string) {
  const rows = await db
    .select({ day: nightReviews.dayKey })
    .from(nightReviews)
    .where(
      and(
        eq(nightReviews.userId, userId),
        gte(nightReviews.dayKey, from),
        lt(nightReviews.dayKey, to),
      ),
    );
  return rows.length;
}

function shiftKey(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
    dt.getDate(),
  ).padStart(2, "0")}`;
}