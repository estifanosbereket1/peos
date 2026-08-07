"use server";

import { and, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { fastingWindows } from "@/db/schema";
import { requireSession } from "@/lib/session";

export type Fast = {
  id: string;
  startAt: Date;
  endAt: Date | null;
  goalHours: number | null;
  note: string | null;
};

export async function getActiveFast(): Promise<Fast | null> {
  const session = await requireSession();
  const row = await db
    .select()
    .from(fastingWindows)
    .where(and(eq(fastingWindows.userId, session.user.id), isNull(fastingWindows.endAt)))
    .orderBy(desc(fastingWindows.startAt))
    .limit(1);
  return row[0] ? toFast(row[0]) : null;
}

export async function startFast(goalHours?: number | null, note?: string) {
  const session = await requireSession();
  const active = await getActiveFast();
  if (active) return active;
  const g = goalHours ? Math.min(72, Math.max(1, Math.round(goalHours))) : null;
  const [row] = await db
    .insert(fastingWindows)
    .values({
      userId: session.user.id,
      startAt: new Date(),
      goalHours: g,
      note: note?.trim() || null,
    })
    .returning();
  revalidatePath("/fasting");
  return toFast(row);
}

export async function stopFast(id: string) {
  const session = await requireSession();
  const owns = await db
    .select({ id: fastingWindows.id })
    .from(fastingWindows)
    .where(and(eq(fastingWindows.id, id), eq(fastingWindows.userId, session.user.id)));
  if (!owns[0]) return;
  const [row] = await db
    .update(fastingWindows)
    .set({ endAt: new Date() })
    .where(eq(fastingWindows.id, id))
    .returning();
  revalidatePath("/fasting");
  return toFast(row);
}

export async function deleteFast(id: string) {
  const session = await requireSession();
  await db
    .delete(fastingWindows)
    .where(and(eq(fastingWindows.id, id), eq(fastingWindows.userId, session.user.id)));
  revalidatePath("/fasting");
}

export async function listFasts(limit = 30) {
  const session = await requireSession();
  const rows = await db
    .select()
    .from(fastingWindows)
    .where(eq(fastingWindows.userId, session.user.id))
    .orderBy(desc(fastingWindows.startAt))
    .limit(limit);
  return rows.map(toFast);
}

type FastRow = typeof fastingWindows.$inferSelect;
function toFast(row: FastRow): Fast {
  return {
    id: row.id,
    startAt: row.startAt,
    endAt: row.endAt,
    goalHours: row.goalHours,
    note: row.note,
  };
}