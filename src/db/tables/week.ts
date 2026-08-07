import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "../auth-schema";

export const weeklyPlans = pgTable(
  "weekly_plans",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    weekStart: text("week_start").notNull(), // Monday YYYY-MM-DD
    reviewed: boolean("reviewed").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("weekly_plans_user_week_idx").on(table.userId, table.weekStart),
  ],
);

export const weeklyAnchors = pgTable(
  "weekly_anchors",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    weeklyPlanId: text("weekly_plan_id")
      .notNull()
      .references(() => weeklyPlans.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    // honest assessment at weekly review; null until reviewed
    followThrough: text("follow_through"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("weekly_anchors_plan_id_idx").on(table.weeklyPlanId),
  ],
);

export const weeklyPlansRelations = relations(weeklyPlans, ({ one, many }) => ({
  user: one(user, {
    fields: [weeklyPlans.userId],
    references: [user.id],
  }),
  anchors: many(weeklyAnchors),
}));

export const weeklyAnchorsRelations = relations(weeklyAnchors, ({ one }) => ({
  plan: one(weeklyPlans, {
    fields: [weeklyAnchors.weeklyPlanId],
    references: [weeklyPlans.id],
  }),
}));