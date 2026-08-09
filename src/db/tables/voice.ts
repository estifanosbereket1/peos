import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  integer,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "../auth-schema";

export const voiceNoteStatus = pgEnum("voice_note_status", [
  "pending",
  "done",
  "failed",
  "skipped",
]);

/** Which section an attached clip belongs to (polymorphic owner). */
export const entryOwnerKind = pgEnum("entry_owner_kind", [
  "learn",
  "proof",
  "review",
]);

export const voiceCategories = pgTable("voice_categories", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const voiceNotes = pgTable(
  "voice_notes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    categoryId: text("category_id").references(() => voiceCategories.id, {
      onDelete: "set null",
    }),
    // Streaming route path, e.g. /api/voice/audio/<id>.
    audioUrl: text("audio_url").notNull(),
    // Raw audio bytes stored as base64 in the DB (no blob storage set up).
    audio: text("audio").notNull(),
    mime: text("mime").notNull().default("audio/webm"),
    transcript: text("transcript"),
    transcriptStatus: voiceNoteStatus("transcript_status").notNull().default("pending"),
    durationSeconds: integer("duration_seconds"),
    // Optional short manual caption.
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("voice_notes_user_idx").on(table.userId)],
);

export const voiceCategoriesRelations = relations(voiceCategories, ({ one, many }) => ({
  user: one(user, {
    fields: [voiceCategories.userId],
    references: [user.id],
  }),
  notes: many(voiceNotes),
}));

export const voiceNotesRelations = relations(voiceNotes, ({ one }) => ({
  user: one(user, {
    fields: [voiceNotes.userId],
    references: [user.id],
  }),
  category: one(voiceCategories, {
    fields: [voiceNotes.categoryId],
    references: [voiceCategories.id],
  }),
}));

/**
 * Voice clips attached to a specific field of an entry in another section
 * (learning log, proof entry, night review). Owner is polymorphic: stored as
 * ownerKind + ownerId + field. Audio is base64 in the DB, same as voice notes.
 * transcriptStatus mirrors voice notes: "skipped" until the user transcribes.
 */
export const entryVoices = pgTable(
  "entry_voices",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ownerKind: entryOwnerKind("owner_kind").notNull(),
    ownerId: text("owner_id").notNull(),
    field: text("field").notNull(),
    audioUrl: text("audio_url").notNull(),
    audio: text("audio").notNull(),
    mime: text("mime").notNull().default("audio/webm"),
    transcript: text("transcript"),
    transcriptStatus: voiceNoteStatus("transcript_status").notNull().default("skipped"),
    durationSeconds: integer("duration_seconds"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("entry_voices_owner_idx").on(table.userId, table.ownerKind, table.ownerId),
    uniqueIndex("entry_voices_unique_field_idx").on(
      table.userId,
      table.ownerKind,
      table.ownerId,
      table.field,
    ),
  ],
);

export const entryVoicesRelations = relations(entryVoices, ({ one }) => ({
  user: one(user, {
    fields: [entryVoices.userId],
    references: [user.id],
  }),
}));