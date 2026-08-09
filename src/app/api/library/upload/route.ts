import { NextResponse } from "next/server";

import { MAX_FILE_BYTES, insertBook } from "@/lib/library";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function detectFormat(name: string, mime: string): "pdf" | "epub" | null {
  const ext = name.toLowerCase().split(".").pop();
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (mime === "application/epub+zip" || ext === "epub") return "epub";
  return null;
}

/** Upload a book file. Multipart fields: title, author (optional), file. */
export async function POST(request: Request) {
  const session = await requireSession();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const title = form.get("title");
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }
  const author = form.get("author");
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Book file is required." }, { status: 400 });
  }

  const format = detectFormat(file.name, file.type);
  if (!format) {
    return NextResponse.json(
      { error: "Only PDF and EPUB files are supported." },
      { status: 400 },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length === 0) {
    return NextResponse.json({ error: "The file is empty." }, { status: 400 });
  }
  if (bytes.length > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `File too large. Max size is ${MAX_FILE_BYTES / 1024 / 1024}MB.` },
      { status: 413 },
    );
  }

  const id = await insertBook({
    userId: session.user.id,
    title,
    author: typeof author === "string" ? author : null,
    bytes,
    mime: file.type || (format === "pdf" ? "application/pdf" : "application/epub+zip"),
    format,
  });
  if (!id) {
    return NextResponse.json({ error: "Upload failed." }, { status: 400 });
  }
  return NextResponse.json({ id });
}
