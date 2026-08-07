"use server";

import { and, asc, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { dailyPlanTasks, dailyPlans } from "@/db/schema";
import { requireSession } from "@/lib/session";

async function getOrCreatePlan(userId: string, dayKey: string) {
  const existing = await db
    .select()
    .from(dailyPlans)
    .where(and(eq(dailyPlans.userId, userId), eq(dailyPlans.dayKey, dayKey)));
  if (existing[0]) return existing[0];
  const [created] = await db
    .insert(dailyPlans)
    .values({ userId, dayKey })
    .onConflictDoNothing()
    .returning();
  return (
    created ??
    (await db
      .select()
      .from(dailyPlans)
      .where(and(eq(dailyPlans.userId, userId), eq(dailyPlans.dayKey, dayKey))))[0]
  );
}

export async function getDayPlan(dayKey: string) {
  const session = await requireSession();
  const plan = await db
    .select()
    .from(dailyPlans)
    .where(and(eq(dailyPlans.userId, session.user.id), eq(dailyPlans.dayKey, dayKey)));
  if (!plan[0]) return [];
  return db
    .select({
      id: dailyPlanTasks.id,
      text: dailyPlanTasks.text,
      completed: dailyPlanTasks.completed,
      sortOrder: dailyPlanTasks.sortOrder,
    })
    .from(dailyPlanTasks)
    .where(eq(dailyPlanTasks.dailyPlanId, plan[0].id))
    .orderBy(asc(dailyPlanTasks.sortOrder));
}

export async function addTask(dayKey: string, text: string) {
  const session = await requireSession();
  const trimmed = text.trim();
  if (!trimmed) return;
  const plan = await getOrCreatePlan(session.user.id, dayKey);
  const [{ value }] = await db
    .select({ value: count() })
    .from(dailyPlanTasks)
    .where(eq(dailyPlanTasks.dailyPlanId, plan.id));
  await db.insert(dailyPlanTasks).values({
    dailyPlanId: plan.id,
    text: trimmed,
    sortOrder: Number(value),
  });
  revalidatePath("/plan");
}

export async function toggleTask(id: string, completed: boolean) {
  const session = await requireSession();
  const planId = await ownedPlanId(session.user.id, id);
  if (!planId) return;
  await db
    .update(dailyPlanTasks)
    .set({ completed, updatedAt: new Date() })
    .where(and(eq(dailyPlanTasks.id, id), eq(dailyPlanTasks.dailyPlanId, planId)));
  revalidatePath("/plan");
}

export async function deleteTask(id: string) {
  const session = await requireSession();
  const planId = await ownedPlanId(session.user.id, id);
  if (!planId) return;
  await db
    .delete(dailyPlanTasks)
    .where(and(eq(dailyPlanTasks.id, id), eq(dailyPlanTasks.dailyPlanId, planId)));
  revalidatePath("/plan");
}

export async function moveTask(id: string, direction: "up" | "down") {
  const session = await requireSession();
  const planId = await ownedPlanId(session.user.id, id);
  if (!planId) return;
  const siblings = await db
    .select({ id: dailyPlanTasks.id, sortOrder: dailyPlanTasks.sortOrder })
    .from(dailyPlanTasks)
    .where(eq(dailyPlanTasks.dailyPlanId, planId))
    .orderBy(asc(dailyPlanTasks.sortOrder));
  const idx = siblings.findIndex((s) => s.id === id);
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= siblings.length) return;
  const t = siblings[idx];
  const other = siblings[swapWith];
  await db.transaction(async (tx) => {
    await tx
      .update(dailyPlanTasks)
      .set({ sortOrder: other.sortOrder })
      .where(eq(dailyPlanTasks.id, t.id));
    await tx
      .update(dailyPlanTasks)
      .set({ sortOrder: t.sortOrder })
      .where(eq(dailyPlanTasks.id, other.id));
  });
  revalidatePath("/plan");
}

/** Returns the task's plan id iff the task belongs to `userId`. */
async function ownedPlanId(userId: string, taskId: string) {
  const row = await db
    .select({ planId: dailyPlanTasks.dailyPlanId })
    .from(dailyPlanTasks)
    .innerJoin(dailyPlans, eq(dailyPlans.id, dailyPlanTasks.dailyPlanId))
    .where(
      and(eq(dailyPlanTasks.id, taskId), eq(dailyPlans.userId, userId)),
    );
  return row[0]?.planId ?? null;
}