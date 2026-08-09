import { relations } from "drizzle-orm";
import {
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { user } from "../auth-schema";

export const bookFormat = pgEnum("book_format", ["pdf", "epub"]);
export const bookStatus = pgEnum("book_status", ["unread", "reading", "finished"]);

/**
 * A user's uploaded book (PDF or EPUB). File bytes are base64 in `file`,
 * streamed back via /api/library/file/<id>. EPUB books track position by CFI
 * in `currentLocation` (page numbers don't fit that model); PDFs track
 * `currentPage`/`totalPages`. `progress` is 0..1 for both, used by the grid.
 */
export const books = pgTable(
  "books",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    author: text("author"),
    fileUrl: text("file_url").notNull(),
    mime: text("mime").notNull(),
    fileSize: integer("file_size").notNull(),
    format: bookFormat("format").notNull(),
    totalPages: integer("total_pages"),
    currentPage: integer("current_page").notNull().default(0),
    currentLocation: text("current_location"),
    progress: doublePrecision("progress").notNull().default(0),
    status: bookStatus("status").notNull().default("unread"),
    addedAt: timestamp("added_at").defaultNow().notNull(),
    lastOpenedAt: timestamp("last_opened_at"),
    file: text("file").notNull(),
  },
  (table) => [index("books_user_idx").on(table.userId)],
);

/** Freeform notes/highlights tied optionally to a page number. */
export const bookNotes = pgTable(
  "book_notes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    bookId: text("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    page: integer("page"),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("book_notes_book_user_idx").on(table.bookId, table.userId)],
);

export const booksRelations = relations(books, ({ one, many }) => ({
  user: one(user, {
    fields: [books.userId],
    references: [user.id],
  }),
  notes: many(bookNotes),
}));

export const bookNotesRelations = relations(bookNotes, ({ one }) => ({
  user: one(user, {
    fields: [bookNotes.userId],
    references: [user.id],
  }),
  book: one(books, {
    fields: [bookNotes.bookId],
    references: [books.id],
  }),
}));
