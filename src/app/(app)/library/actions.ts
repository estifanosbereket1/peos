"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { bookNotes, books } from "@/db/schema";
import { requireSession } from "@/lib/session";

export type BookRow = {
  id: string;
  title: string;
  author: string | null;
  fileUrl: string;
  mime: string;
  fileSize: number;
  format: "pdf" | "epub";
  totalPages: number | null;
  currentPage: number;
  currentLocation: string | null;
  progress: number;
  status: "unread" | "reading" | "finished";
  addedAt: Date;
  lastOpenedAt: Date | null;
};

function toRow(row: typeof books.$inferSelect): BookRow {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    fileUrl: row.fileUrl,
    mime: row.mime,
    fileSize: row.fileSize,
    format: row.format,
    totalPages: row.totalPages,
    currentPage: row.currentPage,
    currentLocation: row.currentLocation,
    progress: row.progress,
    status: row.status,
    addedAt: row.addedAt,
    lastOpenedAt: row.lastOpenedAt,
  };
}

/** All books for the user, most recently opened first. */
export async function listBooks(): Promise<BookRow[]> {
  const session = await requireSession();
  const rows = await db
    .select()
    .from(books)
    .where(eq(books.userId, session.user.id))
    .orderBy(desc(books.lastOpenedAt), desc(books.addedAt));
  return rows.map(toRow);
}

/** A single book owned by the user. */
export async function getBook(id: string): Promise<BookRow | null> {
  const session = await requireSession();
  const rows = await db
    .select()
    .from(books)
    .where(and(eq(books.id, id), eq(books.userId, session.user.id)))
    .limit(1);
  const row = rows[0];
  return row ? toRow(row) : null;
}

/** Edit title/author metadata. */
export async function updateBookMeta(
  id: string,
  input: { title?: string; author?: string | null },
) {
  const session = await requireSession();
  const title = input.title?.trim();
  await db
    .update(books)
    .set({
      ...(title ? { title } : {}),
      ...(input.author !== undefined
        ? { author: input.author?.trim() || null }
        : {}),
    })
    .where(and(eq(books.id, id), eq(books.userId, session.user.id)));
  revalidatePath("/library");
  revalidatePath(`/library/${id}`);
}

export async function setBookStatus(
  id: string,
  status: "unread" | "reading" | "finished",
) {
  const session = await requireSession();
  await db
    .update(books)
    .set({ status })
    .where(and(eq(books.id, id), eq(books.userId, session.user.id)));
  revalidatePath("/library");
  revalidatePath(`/library/${id}`);
}

/** Called when the reader opens: bump lastOpenedAt and unread -> reading. */
export async function markOpened(id: string) {
  const session = await requireSession();
  await db
    .update(books)
    .set({ lastOpenedAt: new Date() })
    .where(and(eq(books.id, id), eq(books.userId, session.user.id)));
  await db
    .update(books)
    .set({ status: "reading" })
    .where(
      and(
        eq(books.id, id),
        eq(books.userId, session.user.id),
        eq(books.status, "unread"),
      ),
    );
  revalidatePath("/library");
}

/**
 * Persist a reading position. `page` (1-based) for PDFs, `location` (CFI) for
 * EPUBs, `totalPages` once known, and a 0..1 progress. Debounced client-side.
 */
export async function savePosition(
  id: string,
  input: {
    page?: number;
    location?: string;
    totalPages?: number | null;
    progress?: number;
  },
) {
  const session = await requireSession();
  const patch: Partial<typeof books.$inferInsert> = {};
  if (typeof input.page === "number" && input.page >= 0) {
    patch.currentPage = input.page;
  }
  if (typeof input.location === "string" && input.location.length > 0) {
    patch.currentLocation = input.location;
  }
  if (input.totalPages === null || typeof input.totalPages === "number") {
    patch.totalPages = input.totalPages;
  }
  if (typeof input.progress === "number") {
    patch.progress = Math.max(0, Math.min(1, input.progress));
  }
  if (Object.keys(patch).length === 0) return;
  await db
    .update(books)
    .set(patch)
    .where(and(eq(books.id, id), eq(books.userId, session.user.id)));
  revalidatePath(`/library/${id}`);
  revalidatePath("/library");
}

export async function deleteBook(id: string) {
  const session = await requireSession();
  await db
    .delete(books)
    .where(and(eq(books.id, id), eq(books.userId, session.user.id)));
  revalidatePath("/library");
}

// ---------- Notes ----------

export type BookNoteRow = {
  id: string;
  page: number | null;
  content: string;
  createdAt: Date;
};

export async function listBookNotes(bookId: string): Promise<BookNoteRow[]> {
  const session = await requireSession();
  const rows = await db
    .select()
    .from(bookNotes)
    .where(
      and(eq(bookNotes.bookId, bookId), eq(bookNotes.userId, session.user.id)),
    )
    .orderBy(desc(bookNotes.createdAt));
  return rows.map((r) => ({
    id: r.id,
    page: r.page,
    content: r.content,
    createdAt: r.createdAt,
  }));
}

export async function addBookNote(bookId: string, content: string, page?: number | null) {
  const session = await requireSession();
  const c = content.trim();
  if (!c) return;
  const owned = await db
    .select({ id: books.id })
    .from(books)
    .where(and(eq(books.id, bookId), eq(books.userId, session.user.id)))
    .limit(1);
  if (!owned[0]) return;
  await db.insert(bookNotes).values({
    bookId,
    userId: session.user.id,
    page: typeof page === "number" && page > 0 ? page : null,
    content: c,
  });
  revalidatePath(`/library/${bookId}`);
}

export async function updateBookNote(
  noteId: string,
  bookId: string,
  content: string,
  page?: number | null,
) {
  const session = await requireSession();
  const c = content.trim();
  await db
    .update(bookNotes)
    .set({
      content: c || undefined,
      ...(page !== undefined ? { page: page ? page > 0 ? page : null : null } : {}),
    })
    .where(
      and(
        eq(bookNotes.id, noteId),
        eq(bookNotes.bookId, bookId),
        eq(bookNotes.userId, session.user.id),
      ),
    );
  revalidatePath(`/library/${bookId}`);
}

export async function deleteBookNote(noteId: string, bookId: string) {
  const session = await requireSession();
  await db
    .delete(bookNotes)
    .where(
      and(
        eq(bookNotes.id, noteId),
        eq(bookNotes.bookId, bookId),
        eq(bookNotes.userId, session.user.id),
      ),
    );
  revalidatePath(`/library/${bookId}`);
}
