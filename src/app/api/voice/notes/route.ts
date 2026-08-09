import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { voiceCategories } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { insertVoiceNote } from "@/lib/voice";

export const dynamic = "force-dynamic";

/** Accepts multipart/form-data: file (required), categoryId, durationSeconds. */
export async function POST(request: Request) {
  const session = await requireSession();
  const userId = session.user.id;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Audio file is required." }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const rawCategory = form.get("categoryId");
  const categoryId = typeof rawCategory === "string" && rawCategory ? rawCategory : null;

  if (categoryId) {
    const owned = await db
      .select({ id: voiceCategories.id })
      .from(voiceCategories)
      .where(and(eq(voiceCategories.id, categoryId), eq(voiceCategories.userId, userId)))
      .limit(1);
    if (owned.length === 0) {
      return NextResponse.json({ error: "Unknown category." }, { status: 400 });
    }
  }

  const rawDuration = Number(form.get("durationSeconds"));
  const durationSeconds =
    Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : null;

  const id = await insertVoiceNote({
    userId,
    bytes,
    mime: file.type || "audio/webm",
    categoryId,
    durationSeconds,
  });
  if (!id) {
    return NextResponse.json({ error: "Audio too large or empty." }, { status: 400 });
  }
  return NextResponse.json({ id });
}