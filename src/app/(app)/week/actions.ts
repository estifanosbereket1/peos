"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { weeklyAnchors, weeklyPlans } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { weekStartKey } from "@/lib/time";

const MAX_ANCHORS = 5;

async function getOrCreateWeek(userId: string, weekStart: string) {
  const existing = await db
    .select()
    .from(weeklyPlans)
    .where(and(eq(weeklyPlans.userId, userId), eq(weeklyPlans.weekStart, weekStart)));
  if (existing[0]) return existing[0];
  const [created] = await db
    .insert(weeklyPlans)
    .values({ userId, weekStart })
    .onConflictDoNothing()
    .returning();
  return (
    created ??
    (await db
      .select()
      .from(weeklyPlans)
      .where(and(eq(weeklyPlans.userId, userId), eq(weeklyPlans.weekStart, weekStart))))[0]
  );
}

export async function getWeek(weekStart: string) {
  const session = await requireSession();
  const plan = await db
    .select()
    .from(weeklyPlans)
    .where(and(eq(weeklyPlans.userId, session.user.id), eq(weeklyPlans.weekStart, weekStart)));
  if (!plan[0]) {
    return { reviewed: false, anchors: [] };
  }
  const anchors = await db
    .select({
      id: weeklyAnchors.id,
      text: weeklyAnchors.text,
      sortOrder: weeklyAnchors.sortOrder,
      followThrough: weeklyAnchors.followThrough,
    })
    .from(weeklyAnchors)
    .where(eq(weeklyAnchors.weeklyPlanId, plan[0].id))
    .orderBy(asc(weeklyAnchors.sortOrder));
  return { reviewed: plan[0].reviewed, anchors };
}

/** Replace the week's anchors with `texts` (keeps any saved follow-through by
 * matching unchanged texts; drops ones not present). Caps at MAX_ANCHORS. */
export async function setAnchors(weekStart: string, texts: string[]) {
  const session = await requireSession();
  const cleaned = texts.map((t) => t.trim()).filter(Boolean).slice(0, MAX_ANCHORS);
  const plan = await getOrCreateWeek(session.user.id, weekStart);

  const existing = await db
    .select()
    .from(weeklyAnchors)
    .where(eq(weeklyAnchors.weeklyPlanId, plan.id));

  // Preserve follow-through for anchors whose text is unchanged.
  const anchorByText = new Map(existing.map((a) => [a.text, a]));

  await db.transaction(async (tx) => {
    await tx.delete(weeklyAnchors).where(eq(weeklyAnchors.weeklyPlanId, plan.id));
    if (cleaned.length) {
      await tx.insert(weeklyAnchors).values(
        cleaned.map((text, i) => ({
          weeklyPlanId: plan.id,
          text,
          sortOrder: i,
          followThrough: anchorByText.get(text)?.followThrough ?? null,
        })),
      );
    }
  });

  revalidatePath("/week");
  revalidatePath("/plan");
}

export async function setFollowThrough(
  weekStart: string,
  follow: Record<string, string>,
) {
  const session = await requireSession();
  const plan = await getOrCreateWeek(session.user.id, weekStart);
  await db.transaction(async (tx) => {
    for (const [anchorId, note] of Object.entries(follow)) {
      await tx
        .update(weeklyAnchors)
        .set({ followThrough: note.trim() || null, updatedAt: new Date() })
        .where(
          and(eq(weeklyAnchors.id, anchorId), eq(weeklyAnchors.weeklyPlanId, plan.id)),
        );
    }
    await tx
      .update(weeklyPlans)
      .set({ reviewed: true, updatedAt: new Date() })
      .where(eq(weeklyPlans.id, plan.id));
  });
  revalidatePath("/week");
}

export async function unreview(weekStart: string) {
  const session = await requireSession();
  const plan = await getOrCreateWeek(session.user.id, weekStart);
  await db
    .update(weeklyPlans)
    .set({ reviewed: false, updatedAt: new Date() })
    .where(eq(weeklyPlans.id, plan.id));
  revalidatePath("/week");
}

/** Read-only anchors for a given day's week (used by the daily plan header). */
export async function getWeekAnchorsForDay(dayKey: string) {
  const session = await requireSession();
  const weekStart = weekStartKey(dayKey);
  const plan = await db
    .select({ id: weeklyPlans.id })
    .from(weeklyPlans)
    .where(and(eq(weeklyPlans.userId, session.user.id), eq(weeklyPlans.weekStart, weekStart)));
  if (!plan[0]) return [] as { text: string }[];
  return db
    .select({ text: weeklyAnchors.text })
    .from(weeklyAnchors)
    .where(eq(weeklyAnchors.weeklyPlanId, plan[0].id))
    .orderBy(asc(weeklyAnchors.sortOrder));
}