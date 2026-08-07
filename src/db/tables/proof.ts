import { relations } from "drizzle-orm";
import { pgEnum, pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

import { user } from "../auth-schema";

export const proofSource = pgEnum("proof_source", ["manual", "auto"]);

export const proofEntries = pgTable(
  "proof_entries",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    source: proofSource("source").notNull().default("manual"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("proof_entries_user_idx").on(table.userId)],
);

export const proofEntriesRelations = relations(proofEntries, ({ one }) => ({
  user: one(user, {
    fields: [proofEntries.userId],
    references: [user.id],
  }),
}));