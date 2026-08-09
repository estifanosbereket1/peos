"use server";

import { and, asc, desc, eq, ilike, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { entryVoices, voiceCategories, voiceNotes } from "@/db/schema";
import { isGroqConfigured } from "@/lib/ai/groq";
import { transcribeEntryVoice } from "@/lib/entry-voice";
import { requireSession } from "@/lib/session";
import { transcribeStoredNote } from "@/lib/voice";

const DEFAULT_CATEGORIES = [
  "Feeling",
  "Technical",
  "Random Thought",
  "Idea",
  "Rant",
];

// ---------- Categories ----------

async function categoriesFor(userId: string) {
  const rows = await db
    .select()
    .from(voiceCategories)
    .where(eq(voiceCategories.userId, userId))
    .orderBy(asc(voiceCategories.sortOrder), asc(voiceCategories.name));
  if (rows.length > 0) return rows;

  // Lazy seed the starter set for a brand-new user.
  await db.insert(voiceCategories).values(
    DEFAULT_CATEGORIES.map((name, i) => ({ userId, name, sortOrder: i })),
  );
  return db
    .select()
    .from(voiceCategories)
    .where(eq(voiceCategories.userId, userId))
    .orderBy(asc(voiceCategories.sortOrder), asc(voiceCategories.name));
}

export async function listCategories() {
  const session = await requireSession();
  return categoriesFor(session.user.id);
}

export async function createCategory(name: string) {
  const session = await requireSession();
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name is required." };
  const [created] = await db
    .insert(voiceCategories)
    .values({ userId: session.user.id, name: trimmed })
    .returning();
  revalidatePath("/voice");
  return { category: created };
}

export async function deleteCategory(id: string) {
  const session = await requireSession();
  await db
    .delete(voiceCategories)
    .where(and(eq(voiceCategories.id, id), eq(voiceCategories.userId, session.user.id)));
  revalidatePath("/voice");
}

// ---------- Notes ----------

export type VoiceNoteRow = {
  id: string;
  categoryId: string | null;
  categoryName: string | null;
  audioUrl: string;
  transcript: string | null;
  transcriptStatus: "pending" | "done" | "failed" | "skipped";
  durationSeconds: number | null;
  note: string | null;
  createdAt: Date;
};

const NOTE_COLUMNS = {
  id: voiceNotes.id,
  categoryId: voiceNotes.categoryId,
  audioUrl: voiceNotes.audioUrl,
  transcript: voiceNotes.transcript,
  transcriptStatus: voiceNotes.transcriptStatus,
  durationSeconds: voiceNotes.durationSeconds,
  note: voiceNotes.note,
  createdAt: voiceNotes.createdAt,
  categoryName: voiceCategories.name,
} as const;

export async function listNotes(limit = 50): Promise<VoiceNoteRow[]> {
  const session = await requireSession();
  return db
    .select(NOTE_COLUMNS)
    .from(voiceNotes)
    .leftJoin(voiceCategories, eq(voiceNotes.categoryId, voiceCategories.id))
    .where(eq(voiceNotes.userId, session.user.id))
    .orderBy(desc(voiceNotes.createdAt))
    .limit(limit);
}

export async function searchNotes(query?: string): Promise<VoiceNoteRow[]> {
  const session = await requireSession();
  const q = query?.trim();
  return db
    .select(NOTE_COLUMNS)
    .from(voiceNotes)
    .leftJoin(voiceCategories, eq(voiceNotes.categoryId, voiceCategories.id))
    .where(
      q
        ? and(
            eq(voiceNotes.userId, session.user.id),
            ilike(voiceNotes.transcript, `%${q}%`),
          )
        : eq(voiceNotes.userId, session.user.id),
    )
    .orderBy(desc(voiceNotes.createdAt))
    .limit(50);
}

export async function updateNote(input: {
  id: string;
  categoryId?: string | null;
  note?: string | null;
}) {
  const session = await requireSession();
  const note = typeof input.note === "string" ? input.note.trim() || null : undefined;
  await db
    .update(voiceNotes)
    .set({
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(note !== undefined ? { note } : {}),
    })
    .where(and(eq(voiceNotes.id, input.id), eq(voiceNotes.userId, session.user.id)));
  revalidatePath("/voice");
}

export async function deleteNote(id: string) {
  const session = await requireSession();
  await db
    .delete(voiceNotes)
    .where(and(eq(voiceNotes.id, id), eq(voiceNotes.userId, session.user.id)));
  revalidatePath("/voice");
}

export async function aiConfigured(): Promise<boolean> {
  return isGroqConfigured();
}

/** Explicitly request transcription for a saved note (user-initiated). */
export async function transcribeNoteNow(id: string): Promise<boolean> {
  const session = await requireSession();
  const note = await db
    .select({ id: voiceNotes.id })
    .from(voiceNotes)
    .where(and(eq(voiceNotes.id, id), eq(voiceNotes.userId, session.user.id)))
    .limit(1);
  if (note.length === 0) return false;
  await transcribeStoredNote(id, session.user.id);
  return true;
}

// ---------- Entry-attached clips (learn / proof / review) ----------

export type EntryClipRow = {
  id: string;
  ownerId: string;
  field: string;
  audioUrl: string;
  transcript: string | null;
  transcriptStatus: "pending" | "done" | "failed" | "skipped";
  durationSeconds: number | null;
  createdAt: Date;
};

/** All voice clips attached to the given entries in one section. */
export async function listEntryClips(
  ownerKind: "learn" | "proof" | "review",
  ownerIds: string[],
): Promise<EntryClipRow[]> {
  const session = await requireSession();
  if (ownerIds.length === 0) return [];
  const rows = await db
    .select({
      id: entryVoices.id,
      ownerId: entryVoices.ownerId,
      field: entryVoices.field,
      audioUrl: entryVoices.audioUrl,
      transcript: entryVoices.transcript,
      transcriptStatus: entryVoices.transcriptStatus,
      durationSeconds: entryVoices.durationSeconds,
      createdAt: entryVoices.createdAt,
    })
    .from(entryVoices)
    .where(
      and(
        eq(entryVoices.userId, session.user.id),
        eq(entryVoices.ownerKind, ownerKind),
        inArray(entryVoices.ownerId, ownerIds),
      ),
    )
    .orderBy(asc(entryVoices.field), asc(entryVoices.createdAt));
  return rows;
}

/** Explicitly transcribe an entry-attached clip (user-initiated). */
export async function transcribeEntryClipNow(id: string): Promise<boolean> {
  const session = await requireSession();
  const clip = await db
    .select({ id: entryVoices.id })
    .from(entryVoices)
    .where(and(eq(entryVoices.id, id), eq(entryVoices.userId, session.user.id)))
    .limit(1);
  if (clip.length === 0) return false;
  await transcribeEntryVoice(id, session.user.id);
  return true;
}

/** Remove a clip attached to an entry. */
export async function deleteEntryClip(id: string): Promise<boolean> {
  const session = await requireSession();
  const deleted = await db
    .delete(entryVoices)
    .where(and(eq(entryVoices.id, id), eq(entryVoices.userId, session.user.id)))
    .returning({ id: entryVoices.id });
  revalidatePath("/");
  return deleted.length > 0;
}