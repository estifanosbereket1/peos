import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { voiceNotes } from "@/db/schema";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Stream a stored voice-note recording back to the browser. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  const { id } = await params;

  const rows = await db
    .select({
      audio: voiceNotes.audio,
      mime: voiceNotes.mime,
    })
    .from(voiceNotes)
    .where(and(eq(voiceNotes.id, id), eq(voiceNotes.userId, session.user.id)))
    .limit(1);
  const row = rows[0];
  if (!row) return new NextResponse("Not found", { status: 404 });

  const bytes = Buffer.from(row.audio, "base64");
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": row.mime || "audio/webm",
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, max-age=3600",
    },
  });
}