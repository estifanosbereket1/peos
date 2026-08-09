import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { entryVoices } from "@/db/schema";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Stream a voice clip attached to a learn/proof/review entry back to the browser. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  const { id } = await params;

  const rows = await db
    .select({ audio: entryVoices.audio, mime: entryVoices.mime })
    .from(entryVoices)
    .where(and(eq(entryVoices.id, id), eq(entryVoices.userId, session.user.id)))
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
