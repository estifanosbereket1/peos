import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { entryVoices } from "@/db/schema";
import { isGroqConfigured, transcribeAudio } from "@/lib/ai/groq";

const MAX_AUDIO_BYTES = 30 * 1024 * 1024;

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
 * Save a voice clip attached to an entry field. Status is "skipped" — audio is
 * stored as-is; transcription only runs when the user explicitly asks (see
 * transcribeEntryVoice). Saving never depends on transcription.
 */
export async function insertEntryVoice(input: {
  userId: string;
  ownerKind: "learn" | "proof" | "review";
  ownerId: string;
  field: string;
  bytes: Uint8Array;
  mime: string;
  durationSeconds?: number | null;
}): Promise<string | null> {
  if (input.bytes.length === 0 || input.bytes.length > MAX_AUDIO_BYTES) {
    return null;
  }
  const id = crypto.randomUUID();
  await db.insert(entryVoices).values({
    id,
    userId: input.userId,
    ownerKind: input.ownerKind,
    ownerId: input.ownerId,
    field: input.field,
    audioUrl: `/api/entry-voice/${id}`,
    audio: bytesToBase64(input.bytes),
    mime: input.mime || "audio/webm",
    transcriptStatus: "skipped",
    durationSeconds:
      typeof input.durationSeconds === "number" &&
      Number.isFinite(input.durationSeconds) &&
      input.durationSeconds >= 0
        ? Math.round(input.durationSeconds)
        : null,
  });
  revalidatePath("/");
  return id;
}

/** Run Groq transcription for a stored entry clip owned by `userId`. */
export async function transcribeEntryVoice(
  clipId: string,
  userId: string,
): Promise<void> {
  const rows = await db
    .select({ audio: entryVoices.audio, mime: entryVoices.mime })
    .from(entryVoices)
    .where(and(eq(entryVoices.id, clipId), eq(entryVoices.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row || !isGroqConfigured()) return;

  const bytes = base64ToBytes(row.audio);
  const text = bytes ? await transcribeAudio(bytes, row.mime) : null;
  await db
    .update(entryVoices)
    .set(
      text
        ? { transcript: text, transcriptStatus: "done" }
        : { transcriptStatus: "failed" },
    )
    .where(eq(entryVoices.id, clipId));
  revalidatePath("/");
}
