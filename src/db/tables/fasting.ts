import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { user } from "../auth-schema";

export const fastingWindows = pgTable(
  "fasting_windows",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    startAt: timestamp("start_at").notNull(), // local, start of fast
    endAt: timestamp("end_at"), // null = still fasting
    goalHours: integer("goal_hours"), // optional target, e.g. 16
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("fasting_windows_user_idx").on(table.userId),
    index("fasting_windows_user_start_idx").on(table.userId, table.startAt),
  ],
);

export const fastingWindowsRelations = relations(fastingWindows, ({ one }) => ({
  user: one(user, {
    fields: [fastingWindows.userId],
    references: [user.id],
  }),
}));