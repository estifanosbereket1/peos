import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { entryVoices, learningLogs, nightReviews, proofEntries } from "@/db/schema";
import { insertEntryVoice } from "@/lib/entry-voice";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const OWNER_KINDS = ["learn", "proof", "review"] as const;

type OwnerKind = (typeof OWNER_KINDS)[number];

function isOwnerKind(v: string): v is OwnerKind {
  return (OWNER_KINDS as readonly string[]).includes(v);
}

function ownerTable(kind: OwnerKind) {
  switch (kind) {
    case "learn":
      return learningLogs;
    case "proof":
      return proofEntries;
    case "review":
      return nightReviews;
  }
}

/**
 * Attach a voice clip to an existing entry. Multipart fields:
 * ownerKind ("learn"|"proof"|"review"), ownerId, field, file (required),
 * durationSeconds (optional). Replaces any existing clip for that field.
 */
export async function POST(request: Request) {
  const session = await requireSession();
  const userId = session.user.id;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const rawKind = form.get("ownerKind");
  if (typeof rawKind !== "string" || !isOwnerKind(rawKind)) {
    return NextResponse.json({ error: "Unknown owner kind." }, { status: 400 });
  }
  const ownerKind = rawKind;

  const ownerId = form.get("ownerId");
  const field = form.get("field");
  if (typeof ownerId !== "string" || !ownerId || typeof field !== "string" || !field) {
    return NextResponse.json({ error: "ownerId and field are required." }, { status: 400 });
  }

  // The entry must exist and belong to this user.
  const table = ownerTable(ownerKind);
  const owned = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.userId, userId), eq(table.id, ownerId)))
    .limit(1);
  if (owned.length === 0) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Audio file is required." }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const rawDuration = Number(form.get("durationSeconds"));
  const durationSeconds =
    Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : null;

  // Replace: drop any existing clip for this field, then insert fresh.
  await db
    .delete(entryVoices)
    .where(
      and(
        eq(entryVoices.userId, userId),
        eq(entryVoices.ownerKind, ownerKind),
        eq(entryVoices.ownerId, ownerId),
        eq(entryVoices.field, field),
      ),
    );

  const id = await insertEntryVoice({
    userId,
    ownerKind,
    ownerId,
    field,
    bytes,
    mime: file.type || "audio/webm",
    durationSeconds,
  });
  if (!id) {
    return NextResponse.json({ error: "Audio too large or empty." }, { status: 400 });
  }
  return NextResponse.json({ id });
}
