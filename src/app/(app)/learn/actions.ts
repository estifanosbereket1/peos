"use server";

import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import {
  learningLogSource,
  learningLogs,
  learningTopics,
} from "@/db/schema";
import { getSuggestionsForDay } from "@/lib/learning-suggestions";
import { toLearningLogRow } from "@/lib/learning-row";
import { isGroqConfigured } from "@/lib/ai/groq";
import { requireSession } from "@/lib/session";
import { todayKey } from "@/lib/time";

const LOG_LIMIT = 30;

/** Ensure `key` is a sane day key before it is used as an input column. */
function validDayKey(key: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(key);
}

export async function getSuggestions(dayKey: string = todayKey()) {
  const session = await requireSession();
  const topics = await db
    .select({ name: learningTopics.name })
    .from(learningTopics)
    .where(eq(learningTopics.userId, session.user.id))
    .orderBy(asc(learningTopics.createdAt));
  const history = await db
    .select({
      topic: learningLogs.topic,
      content: learningLogs.content,
      explainBack: learningLogs.explainBack,
    })
    .from(learningLogs)
    .where(eq(learningLogs.userId, session.user.id))
    .orderBy(desc(learningLogs.createdAt))
    .limit(10)
    .then((rows) => rows.reverse());
  const suggestions = await getSuggestionsForDay(
    validDayKey(dayKey) ? dayKey : todayKey(),
    topics.map((t) => t.name),
    history,
  );
  return suggestions;
}

export type LogRow = {
  id: string;
  learnDate: string;
  topic: string;
  content: string;
  explainBack: string | null;
  source: typeof learningLogSource.enumValues[number];
  updatedAt: Date;
};

export async function getDayLog(dayKey: string = todayKey()) {
  const session = await requireSession();
  if (!validDayKey(dayKey)) return [];
  const rows = await db
    .select()
    .from(learningLogs)
    .where(
      and(
        eq(learningLogs.userId, session.user.id),
        eq(learningLogs.learnDate, dayKey),
      ),
    )
    .orderBy(desc(learningLogs.createdAt));
  return rows.map(toLearningLogRow);
}

export async function createLog(
  dayKey: string,
  topic: string,
  content: string,
  source: "suggestion" | "user" | "ai" = "user",
  explainBack?: string,
): Promise<string | null> {
  const session = await requireSession();
  const t = topic.trim();
  const c = content.trim();
  const e = explainBack?.trim();
  if (!t || !validDayKey(dayKey)) return null;
  const [created] = await db
    .insert(learningLogs)
    .values({
      userId: session.user.id,
      learnDate: validDayKey(dayKey) ? dayKey : todayKey(),
      topic: t,
      content: c || null,
      source,
      explainBack: e || null,
    })
    .returning({ id: learningLogs.id });
  revalidatePath("/learn");
  return created?.id ?? null;
}

export async function updateLog(
  id: string,
  topic: string,
  content: string,
  explainBack?: string,
) {
  const session = await requireSession();
  const owns = await db
    .select({ id: learningLogs.id })
    .from(learningLogs)
    .where(and(eq(learningLogs.id, id), eq(learningLogs.userId, session.user.id)));
  if (!owns[0]) return;
  const e = explainBack?.trim();
  await db
    .update(learningLogs)
    .set({
      topic: topic.trim(),
      content: content.trim() || null,
      explainBack: e || null,
      updatedAt: new Date(),
    })
    .where(eq(learningLogs.id, id));
  revalidatePath("/learn");
}

export async function deleteLog(id: string) {
  const session = await requireSession();
  await db
    .delete(learningLogs)
    .where(and(eq(learningLogs.id, id), eq(learningLogs.userId, session.user.id)));
  revalidatePath("/learn");
}

export async function searchLogs(query?: string) {
  const session = await requireSession();
  const q = query?.trim();
  const base = eq(learningLogs.userId, session.user.id);
  const rows = await db
    .select()
    .from(learningLogs)
    .where(
      q
        ? and(base, or(ilike(learningLogs.topic, `%${q}%`), ilike(learningLogs.content, `%${q}%`)))
        : base,
    )
    .orderBy(desc(learningLogs.createdAt))
    .limit(LOG_LIMIT);
  return rows.map(toLearningLogRow);
}

export async function listTopics() {
  const session = await requireSession();
  return db
    .select({ id: learningTopics.id, name: learningTopics.name })
    .from(learningTopics)
    .where(eq(learningTopics.userId, session.user.id))
    .orderBy(asc(learningTopics.name));
}

export async function addTopic(name: string) {
  const session = await requireSession();
  const n = name.trim();
  if (!n) return;
  await db.insert(learningTopics).values({ userId: session.user.id, name: n });
  revalidatePath("/learn");
}

export async function removeTopic(id: string) {
  const session = await requireSession();
  await db
    .delete(learningTopics)
    .where(and(eq(learningTopics.id, id), eq(learningTopics.userId, session.user.id)));
  revalidatePath("/learn");
}

export async function aiConfigured(): Promise<boolean> {
  return isGroqConfigured();
}