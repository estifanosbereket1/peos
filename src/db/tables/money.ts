import { relations } from "drizzle-orm";
import {
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "../auth-schema";

export const transactionType = pgEnum("transaction_type", ["expense", "income"]);

export const expenseCategories = pgTable("expense_categories", {
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

export const transactions = pgTable(
  "transactions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // income entries don't need a category
    type: transactionType("type").notNull(),
    categoryId: text("category_id").references(() => expenseCategories.id, {
      onDelete: "set null",
    }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    note: text("note"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("transactions_user_idx").on(table.userId),
    index("transactions_user_occurred_idx").on(table.userId, table.occurredAt),
  ],
);

export const weeklyBudgets = pgTable(
  "weekly_budgets",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Monday YYYY-MM-DD
    weekStart: text("week_start").notNull(),
    totalBudget: numeric("total_budget", { precision: 12, scale: 2 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("weekly_budgets_user_week_idx").on(table.userId, table.weekStart),
  ],
);

export const categoryBudgets = pgTable(
  "category_budgets",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    weeklyBudgetId: text("weekly_budget_id")
      .notNull()
      .references(() => weeklyBudgets.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => expenseCategories.id, { onDelete: "cascade" }),
    limit: numeric("limit", { precision: 12, scale: 2 }).notNull(),
  },
  (table) => [
    uniqueIndex("category_budgets_budget_category_idx").on(
      table.weeklyBudgetId,
      table.categoryId,
    ),
  ],
);

export const expenseCategoriesRelations = relations(
  expenseCategories,
  ({ one, many }) => ({
    user: one(user, {
      fields: [expenseCategories.userId],
      references: [user.id],
    }),
    budgets: many(categoryBudgets),
  }),
);

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(user, {
    fields: [transactions.userId],
    references: [user.id],
  }),
  category: one(expenseCategories, {
    fields: [transactions.categoryId],
    references: [expenseCategories.id],
  }),
}));

export const weeklyBudgetsRelations = relations(
  weeklyBudgets,
  ({ one, many }) => ({
    user: one(user, {
      fields: [weeklyBudgets.userId],
      references: [user.id],
    }),
    categoryBudgets: many(categoryBudgets),
  }),
);

export const categoryBudgetsRelations = relations(
  categoryBudgets,
  ({ one }) => ({
    weeklyBudget: one(weeklyBudgets, {
      fields: [categoryBudgets.weeklyBudgetId],
      references: [weeklyBudgets.id],
    }),
    category: one(expenseCategories, {
      fields: [categoryBudgets.categoryId],
      references: [expenseCategories.id],
    }),
  }),
);
