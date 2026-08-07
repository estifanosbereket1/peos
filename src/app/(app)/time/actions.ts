"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { timeCategories, timeEntries } from "@/db/schema";
import { requireSession } from "@/lib/session";

const DEFAULT_CATEGORIES: { name: string; color: string }[] = [
  { name: "Work", color: "#4b5563" },
  { name: "Learning", color: "#2f6f6f" },
  { name: "Reading", color: "#7a5c2e" },
  { name: "Transport", color: "#6b7280" },
  { name: "Rest", color: "#5f7a5f" },
  { name: "Chores", color: "#8a6d5a" },
  { name: "Social", color: "#7c5e74" },
];

/** Normalize an optional energy rating to a valid 1-5 value or null. */
function validEnergy(energy?: number | null): number | null {
  if (typeof energy !== "number" || Number.isNaN(energy)) return null;
  return Math.min(5, Math.max(1, Math.round(energy)));
}

async function categoriesFor(userId: string) {
  const rows = await db
    .select()
    .from(timeCategories)
    .where(eq(timeCategories.userId, userId))
    .orderBy(asc(timeCategories.sortOrder), asc(timeCategories.name));
  if (rows.length > 0) return rows;

  // Lazy seed defaults for a brand-new user.
  await db.insert(timeCategories).values(
    DEFAULT_CATEGORIES.map((c, i) => ({
      userId,
      name: c.name,
      color: c.color,
      sortOrder: i,
    })),
  );
  return db
    .select()
    .from(timeCategories)
    .where(eq(timeCategories.userId, userId))
    .orderBy(asc(timeCategories.sortOrder), asc(timeCategories.name));
}

export async function listCategories() {
  const session = await requireSession();
  return categoriesFor(session.user.id);
}

export async function createCategory(name: string, color?: string) {
  const session = await requireSession();
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name is required." };
  const [created] = await db
    .insert(timeCategories)
    .values({
      userId: session.user.id,
      name: trimmed,
      color: color || DEFAULT_CATEGORIES[0].color,
    })
    .returning();
  revalidatePath("/time");
  return { category: created };
}

export async function deleteCategory(id: string) {
  const session = await requireSession();
  await db
    .delete(timeCategories)
    .where(
      and(eq(timeCategories.id, id), eq(timeCategories.userId, session.user.id)),
    );
  revalidatePath("/time");
}

/**
 * Entries overlapping [dayStart, dayEnd). Boundaries are instants provided by
 * the client (already local-midnight-adjusted in the browser), so timezone
 * handling stays correct regardless of where the server runs.
 */
export async function getDayEntries(from: string, to: string) {
  const session = await requireSession();
  const fromDate = new Date(from);
  const toDate = new Date(to);
  return db
    .select({
      id: timeEntries.id,
      categoryId: timeEntries.categoryId,
      note: timeEntries.note,
      energy: timeEntries.energy,
      startAt: timeEntries.startAt,
      endAt: timeEntries.endAt,
    })
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.userId, session.user.id),
        // entries that overlap [from, to): start < to AND end > from
        // a live entry (endAt null) still shows if it started before `to`
      ),
    )
    .then(async (all) => {
      const rows = all.filter((e) => {
        const start = new Date(e.startAt);
        if (start.getTime() >= toDate.getTime()) return false;
        const end = e.endAt ? new Date(e.endAt) : null;
        if (end && end.getTime() <= fromDate.getTime()) return false;
        return true;
      });
      return rows;
    });
}

export async function startTimer(categoryId: string | null, note: string | null, now: string) {
  const session = await requireSession();
  const [created] = await db
    .insert(timeEntries)
    .values({
      userId: session.user.id,
      categoryId,
      note: note?.trim() || null,
      startAt: new Date(now),
      endAt: null,
    })
    .returning();
  revalidatePath("/time");
  return created;
}

export async function stopTimer(id: string, now: string, energy?: number | null) {
  const session = await requireSession();
  const stopAt = new Date(now);
  const [updated] = await db
    .update(timeEntries)
    .set({ endAt: stopAt, energy: validEnergy(energy) })
    .where(
      and(eq(timeEntries.id, id), eq(timeEntries.userId, session.user.id)),
    )
    .returning();
  revalidatePath("/time");
  return updated;
}

export async function createEntry(input: {
  categoryId: string | null;
  note: string | null;
  startAt: string;
  endAt: string;
  energy?: number | null;
}) {
  const session = await requireSession();
  const start = new Date(input.startAt);
  const end = new Date(input.endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { error: "Invalid start or end time." };
  }
  if (end.getTime() <= start.getTime()) {
    return { error: "End must be after start." };
  }
  const [created] = await db
    .insert(timeEntries)
    .values({
      userId: session.user.id,
      categoryId: input.categoryId,
      note: input.note?.trim() || null,
      energy: validEnergy(input.energy),
      startAt: start,
      endAt: end,
    })
    .returning();
  revalidatePath("/time");
  return created;
}

export async function updateEntry(input: {
  id: string;
  categoryId: string | null;
  note: string | null;
  startAt: string;
  endAt: string | null;
  energy?: number | null;
}) {
  const session = await requireSession();
  const start = new Date(input.startAt);
  const end = input.endAt ? new Date(input.endAt) : null;
  if (Number.isNaN(start.getTime()) || (end && Number.isNaN(end.getTime()))) {
    return { error: "Invalid start or end time." };
  }
  const [updated] = await db
    .update(timeEntries)
    .set({
      categoryId: input.categoryId,
      note: input.note?.trim() || null,
      energy: validEnergy(input.energy),
      startAt: start,
      endAt: end,
      updatedAt: new Date(),
    })
    .where(
      and(eq(timeEntries.id, input.id), eq(timeEntries.userId, session.user.id)),
    )
    .returning();
  revalidatePath("/time");
  return updated;
}

export async function deleteEntry(id: string) {
  const session = await requireSession();
  await db
    .delete(timeEntries)
    .where(and(eq(timeEntries.id, id), eq(timeEntries.userId, session.user.id)));
  revalidatePath("/time");
}