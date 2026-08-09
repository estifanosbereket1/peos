import { NextResponse } from "next/server";

import { transcribeAudio } from "@/lib/ai/groq";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Accepts multipart/form-data: file (required). Returns { text } or { text: null }. */
export async function POST(request: Request) {
  const session = await requireSession();
  void session;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ text: null }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ text: null }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length === 0) {
    return NextResponse.json({ text: null }, { status: 400 });
  }

  const text = await transcribeAudio(bytes, file.type || "audio/webm");
  return NextResponse.json({ text });
}