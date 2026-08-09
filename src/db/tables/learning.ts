import { relations } from "drizzle-orm";
import { pgEnum, pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

import { user } from "../auth-schema";

export const learningLogSource = pgEnum("learning_log_source", [
  "suggestion",
  "user",
  "ai",
]);

export const learningTopics = pgTable("learning_topics", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const learningLogs = pgTable(
  "learning_logs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    learnDate: text("learn_date").notNull(), // YYYY-MM-DD (local)
    topic: text("topic").notNull(),
    content: text("content"), // null when the entry is a voice-only clip
    explainBack: text("explain_back"), // teach-it-back (optional)
    source: learningLogSource("source").notNull().default("user"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("learning_logs_user_date_idx").on(table.userId, table.learnDate),
  ],
);

export const learningTopicsRelations = relations(learningTopics, ({ one }) => ({
  user: one(user, {
    fields: [learningTopics.userId],
    references: [user.id],
  }),
}));

export const learningLogsRelations = relations(learningLogs, ({ one }) => ({
  user: one(user, {
    fields: [learningLogs.userId],
    references: [user.id],
  }),
}));