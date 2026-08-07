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

export const dailyPlans = pgTable(
  "daily_plans",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    dayKey: text("day_key").notNull(), // YYYY-MM-DD (local)
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("daily_plans_user_day_key_idx").on(table.userId, table.dayKey),
  ],
);

export const dailyPlanTasks = pgTable(
  "daily_plan_tasks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    dailyPlanId: text("daily_plan_id")
      .notNull()
      .references(() => dailyPlans.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    completed: boolean("completed").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("daily_plan_tasks_plan_id_idx").on(table.dailyPlanId),
  ],
);

export const dailyPlansRelations = relations(dailyPlans, ({ one, many }) => ({
  user: one(user, {
    fields: [dailyPlans.userId],
    references: [user.id],
  }),
  tasks: many(dailyPlanTasks),
}));

export const dailyPlanTasksRelations = relations(dailyPlanTasks, ({ one }) => ({
  plan: one(dailyPlans, {
    fields: [dailyPlanTasks.dailyPlanId],
    references: [dailyPlans.id],
  }),
}));