import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";

import { user } from "../auth-schema";

export const timeCategories = pgTable("time_categories", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#8a8f98"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const timeEntries = pgTable("time_entries", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  categoryId: text("category_id").references(() => timeCategories.id, {
    onDelete: "set null",
  }),
  note: text("note"),
  // energy felt during the block 1-5 (optional)
  energy: integer("energy"),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  // null = a live (still running) timer entry
  endAt: timestamp("end_at", { withTimezone: true }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const timeCategoriesRelations = relations(timeCategories, ({ one, many }) => ({
  user: one(user, {
    fields: [timeCategories.userId],
    references: [user.id],
  }),
  entries: many(timeEntries),
}));

export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  user: one(user, {
    fields: [timeEntries.userId],
    references: [user.id],
  }),
  category: one(timeCategories, {
    fields: [timeEntries.categoryId],
    references: [timeCategories.id],
  }),
}));