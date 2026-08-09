import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { books } from "@/db/schema";

/**
 * Sane cap for book files. PDFs/EPUBs are far larger than voice clips —
 * 50MB keeps Postgres text columns comfortable while accepting real books.
 */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

/**
 * Insert a book from raw file bytes. Validates size; returns the new id or
 * null when the file is empty / over the cap.
 */
export async function insertBook(input: {
  userId: string;
  title: string;
  author: string | null;
  bytes: Uint8Array;
  mime: string;
  format: "pdf" | "epub";
}): Promise<string | null> {
  if (input.bytes.length === 0 || input.bytes.length > MAX_FILE_BYTES) {
    return null;
  }
  const id = crypto.randomUUID();
  await db.insert(books).values({
    id,
    userId: input.userId,
    title: input.title.trim(),
    author: input.author?.trim() || null,
    fileUrl: `/api/library/file/${id}`,
    mime: input.mime,
    fileSize: input.bytes.length,
    format: input.format,
    file: bytesToBase64(input.bytes),
  });
  revalidatePath("/library");
  return id;
}
