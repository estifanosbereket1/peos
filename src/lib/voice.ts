import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { voiceNotes } from "@/db/schema";
import { isGroqConfigured, transcribeAudio } from "@/lib/ai/groq";

// Capped under Vercel's 4.5MB serverless request-body limit — voice notes
// are short clips, so this is well above what a real recording needs.
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

function validDuration(d?: number | null): number | null {
  if (typeof d !== "number" || Number.isNaN(d) || d < 0) return null;
  return Math.round(d);
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function base64ToBytes(b64: string): Uint8Array | null {
  try {
    return new Uint8Array(Buffer.from(b64, "base64"));
  } catch {
    return null;
  }
}

/**
 * Insert a voice note from raw audio bytes. Status is "skipped" — audio is
 * saved as-is and transcription only happens when the user explicitly asks
 * (see transcribeStoredNote). Saving never depends on transcription.
 */
export async function insertVoiceNote(input: {
  userId: string;
  bytes: Uint8Array;
  mime: string;
  categoryId?: string | null;
  durationSeconds?: number | null;
}): Promise<string | null> {
  if (input.bytes.length === 0 || input.bytes.length > MAX_AUDIO_BYTES) {
    return null;
  }
  const id = crypto.randomUUID();
  await db.insert(voiceNotes).values({
    id,
    userId: input.userId,
    categoryId: input.categoryId || null,
    audioUrl: `/api/voice/audio/${id}`,
    audio: bytesToBase64(input.bytes),
    mime: input.mime || "audio/webm",
    durationSeconds: validDuration(input.durationSeconds),
    transcriptStatus: "skipped",
  });
  revalidatePath("/voice");
  return id;
}

/** Run Groq transcription for a stored note owned by `userId`. */
export async function transcribeStoredNote(
  noteId: string,
  userId: string,
): Promise<void> {
  const rows = await db
    .select({ audio: voiceNotes.audio, mime: voiceNotes.mime })
    .from(voiceNotes)
    .where(and(eq(voiceNotes.id, noteId), eq(voiceNotes.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row || !isGroqConfigured()) return;

  const bytes = base64ToBytes(row.audio);
  const text = bytes ? await transcribeAudio(bytes, row.mime) : null;
  await db
    .update(voiceNotes)
    .set(
      text
        ? { transcript: text, transcriptStatus: "done" }
        : { transcriptStatus: "failed" },
    )
    .where(eq(voiceNotes.id, noteId));
  revalidatePath("/voice");
}