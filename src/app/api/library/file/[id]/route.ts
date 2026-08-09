import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { books } from "@/db/schema";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Stream a stored book file back to the browser with its correct MIME. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  const { id } = await params;

  const rows = await db
    .select({ file: books.file, mime: books.mime })
    .from(books)
    .where(and(eq(books.id, id), eq(books.userId, session.user.id)))
    .limit(1);
  const row = rows[0];
  if (!row) return new NextResponse("Not found", { status: 404 });

  const bytes = Buffer.from(row.file, "base64");
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": row.mime || "application/octet-stream",
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
