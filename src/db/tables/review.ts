import { relations } from "drizzle-orm";
import {
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "../auth-schema";

export const nightReviews = pgTable(
  "night_reviews",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    dayKey: text("day_key").notNull(),
    wins: text("wins"), // what went well / highlights
    improve: text("improve"), // what could have gone better
    nextMove: text("next_move"), // one carry-forward for tomorrow
    energy: smallint("energy"), // optional 1–5 signal
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("night_reviews_user_day_unique").on(table.userId, table.dayKey),
  ],
);

export const nightReviewsRelations = relations(nightReviews, ({ one }) => ({
  user: one(user, {
    fields: [nightReviews.userId],
    references: [user.id],
  }),
}));