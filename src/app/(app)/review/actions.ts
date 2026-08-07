"use server";

import { and, desc, eq, ilike, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { nightReviews } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { todayKey } from "@/lib/time";

function validDayKey(key: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(key);
}

export async function getReview(dayKey: string = todayKey()) {
  const session = await requireSession();
  if (!validDayKey(dayKey)) return null;
  const rows = await db
    .select()
    .from(nightReviews)
    .where(
      and(
        eq(nightReviews.userId, session.user.id),
        eq(nightReviews.dayKey, dayKey),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export type SaveReviewInput = {
  dayKey: string;
  wins?: string | null;
  improve?: string | null;
  nextMove?: string | null;
  energy?: number | null;
};

export async function saveReview(input: SaveReviewInput) {
  const session = await requireSession();
  if (!validDayKey(input.dayKey)) return;
  const energy =
    input.energy == null
      ? null
      : Math.min(5, Math.max(1, Math.round(input.energy)));
  await db
    .insert(nightReviews)
    .values({
      userId: session.user.id,
      dayKey: input.dayKey,
      wins: input.wins?.trim() || null,
      improve: input.improve?.trim() || null,
      nextMove: input.nextMove?.trim() || null,
      energy,
    })
    .onConflictDoUpdate({
      target: [nightReviews.userId, nightReviews.dayKey],
      set: {
        wins: input.wins?.trim() || null,
        improve: input.improve?.trim() || null,
        nextMove: input.nextMove?.trim() || null,
        energy,
        updatedAt: new Date(),
      },
    });
  revalidatePath("/review");
}

export async function listReviews(limit = 60) {
  const session = await requireSession();
  return db
    .select()
    .from(nightReviews)
    .where(eq(nightReviews.userId, session.user.id))
    .orderBy(desc(nightReviews.dayKey))
    .limit(limit);
}

export async function searchReviews(query?: string, limit = 30) {
  const session = await requireSession();
  const q = query?.trim();
  const base = eq(nightReviews.userId, session.user.id);
  const rows = await db
    .select()
    .from(nightReviews)
    .where(
      q
        ? and(
            base,
            or(
              ilike(nightReviews.wins, `%${q}%`),
              ilike(nightReviews.improve, `%${q}%`),
              ilike(nightReviews.nextMove, `%${q}%`),
            ),
          )
        : base,
    )
    .orderBy(desc(nightReviews.dayKey))
    .limit(limit);
  return rows;
}