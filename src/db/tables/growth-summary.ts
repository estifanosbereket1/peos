import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

import { user } from "../auth-schema";

export const growthSummaries = pgTable(
  "growth_summaries",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("growth_summaries_user_idx").on(table.userId)],
);

export const growthSummariesRelations = relations(growthSummaries, ({ one }) => ({
  user: one(user, {
    fields: [growthSummaries.userId],
    references: [user.id],
  }),
}));
