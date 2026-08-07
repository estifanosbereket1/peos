"use server";

import { and, asc, desc, eq, ilike, lt, notInArray, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import {
  categoryBudgets,
  expenseCategories,
  transactions,
  weeklyBudgets,
} from "@/db/schema";
import { requireSession } from "@/lib/session";
import { shiftDayKey, todayKey, weekStartKey } from "@/lib/time";

const DEFAULT_CATEGORIES: string[] = [
  "Food",
  "Transport",
  "Rent/Housing",
  "Utilities",
  "Health",
  "Shopping",
  "Entertainment",
  "Subscriptions",
  "Other",
];

function toNumber(v: string | number | null): number | null {
  return v == null ? null : typeof v === "number" ? v : Number(v);
}

export type CategoryRow = {
  id: string;
  name: string;
  sortOrder: number;
};

export type TransactionRow = {
  id: string;
  type: "expense" | "income";
  categoryId: string | null;
  amount: number;
  note: string | null;
  occurredAt: Date;
  categoryName: string | null;
};

export type BudgetRow = {
  totalBudget: number | null;
  // whether this week has no saved budget and used last week's as the default
  carriedForward: boolean;
  categoryLimits: { categoryId: string; limit: number }[];
};

export type WeekSummary = {
  weekStart: string;
  spent: number;
  income: number;
  net: number;
  spentToday: number;
  budget: BudgetRow;
  byCategory: {
    categoryId: string | null;
    name: string;
    spent: number;
    limit: number | null;
  }[];
};

// ---------- Categories ----------

async function categoriesFor(userId: string): Promise<CategoryRow[]> {
  const rows = await db
    .select()
    .from(expenseCategories)
    .where(eq(expenseCategories.userId, userId))
    .orderBy(asc(expenseCategories.sortOrder), asc(expenseCategories.name));

  if (rows.length > 0) {
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      sortOrder: r.sortOrder,
    }));
  }

  // Lazy-seed a starter set for a brand-new user.
  await db.insert(expenseCategories).values(
    DEFAULT_CATEGORIES.map((name, i) => ({
      userId,
      name,
      sortOrder: i,
    })),
  );
  return db
    .select()
    .from(expenseCategories)
    .where(eq(expenseCategories.userId, userId))
    .orderBy(asc(expenseCategories.sortOrder), asc(expenseCategories.name))
    .then((r) =>
      r.map((x) => ({ id: x.id, name: x.name, sortOrder: x.sortOrder })),
    );
}

export async function listCategories(): Promise<CategoryRow[]> {
  const session = await requireSession();
  return categoriesFor(session.user.id);
}

export async function createCategory(name: string) {
  const session = await requireSession();
  const trimmed = name.trim();
  if (!trimmed) return;
  const [last] = await db
    .select({ sortOrder: expenseCategories.sortOrder })
    .from(expenseCategories)
    .where(eq(expenseCategories.userId, session.user.id))
    .orderBy(desc(expenseCategories.sortOrder))
    .limit(1);
  await db.insert(expenseCategories).values({
    userId: session.user.id,
    name: trimmed,
    sortOrder: (last?.sortOrder ?? 0) + 1,
  });
  revalidatePath("/money");
}

export async function removeCategory(id: string) {
  const session = await requireSession();
  await db
    .delete(expenseCategories)
    .where(
      and(
        eq(expenseCategories.id, id),
        eq(expenseCategories.userId, session.user.id),
      ),
    );
  revalidatePath("/money");
}

// ---------- Transactions ----------

function validTx(v: string): boolean {
  return v != null && !Number.isNaN(new Date(v).getTime());
}

function toTransactionRow(row: typeof transactions.$inferSelect): TransactionRow {
  return {
    id: row.id,
    type: row.type,
    categoryId: row.categoryId,
    amount: toNumber(row.amount) ?? 0,
    note: row.note,
    occurredAt: row.occurredAt,
    categoryName: null, // filled by list queries with a join
  };
}

export async function getTransactions(): Promise<TransactionRow[]> {
  const session = await requireSession();
  const rows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, session.user.id))
    .orderBy(desc(transactions.occurredAt))
    .limit(200);
  const categories = await listCategories();
  const byId = new Map(categories.map((c) => [c.id, c.name]));
  return rows.map((r) => ({
    ...toTransactionRow(r),
    categoryName: r.categoryId ? byId.get(r.categoryId) ?? null : null,
  }));
}

export async function searchTransactions(
  query?: string,
  filters?: { type?: "expense" | "income"; categoryId?: string },
): Promise<TransactionRow[]> {
  const session = await requireSession();
  const q = query?.trim();
  const conditions = [eq(transactions.userId, session.user.id)];
  if (filters?.type) conditions.push(eq(transactions.type, filters.type));
  if (filters?.categoryId)
    conditions.push(eq(transactions.categoryId, filters.categoryId));
  if (q)
    conditions.push(
      or(
        ilike(transactions.note, `%${q}%`),
        ilike(sql`${transactions.amount}::text`, `%${q}%`),
      )!,
    );
  const rows = await db
    .select()
    .from(transactions)
    .where(and(...conditions))
    .orderBy(desc(transactions.occurredAt))
    .limit(100);
  const categories = await listCategories();
  const byId = new Map(categories.map((c) => [c.id, c.name]));
  return rows.map((r) => ({
    ...toTransactionRow(r),
    categoryName: r.categoryId ? byId.get(r.categoryId) ?? null : null,
  }));
}

export async function getTransaction(id: string): Promise<TransactionRow | null> {
  const session = await requireSession();
  const [row] = await db
    .select()
    .from(transactions)
    .where(
      and(eq(transactions.id, id), eq(transactions.userId, session.user.id)),
    )
    .limit(1);
  if (!row) return null;
  const categories = await listCategories();
  const byId = new Map(categories.map((c) => [c.id, c.name]));
  return {
    ...toTransactionRow(row),
    categoryName: row.categoryId ? byId.get(row.categoryId) ?? null : null,
  };
}

export async function createTransaction(input: {
  type: "expense" | "income";
  categoryId: string | null;
  amount: number;
  note?: string | null;
  occurredAt: string;
}) {
  const session = await requireSession();
  const amt = Number(input.amount);
  if (Number.isNaN(amt) || amt <= 0) return { error: "Enter a valid amount." };
  if (!validTx(input.occurredAt)) return { error: "Invalid date." };
  await db.insert(transactions).values({
    userId: session.user.id,
    type: input.type,
    categoryId: input.type === "income" ? null : input.categoryId,
    amount: String(amt.toFixed(2)),
    note: input.note?.trim() || null,
    occurredAt: new Date(input.occurredAt),
  });
  revalidatePath("/money");
  revalidatePath("/");
}

export async function updateTransaction(input: {
  id: string;
  type: "expense" | "income";
  categoryId: string | null;
  amount: number;
  note?: string | null;
  occurredAt: string;
}) {
  const session = await requireSession();
  const amt = Number(input.amount);
  if (Number.isNaN(amt) || amt <= 0) return { error: "Enter a valid amount." };
  if (!validTx(input.occurredAt)) return { error: "Invalid date." };
  const [updated] = await db
    .update(transactions)
    .set({
      type: input.type,
      categoryId: input.type === "income" ? null : input.categoryId,
      amount: amt.toFixed(2),
      note: input.note?.trim() || null,
      occurredAt: new Date(input.occurredAt),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(transactions.id, input.id),
        eq(transactions.userId, session.user.id),
      ),
    )
    .returning();
  revalidatePath("/money");
  revalidatePath("/");
  return updated;
}

export async function deleteTransaction(id: string) {
  const session = await requireSession();
  await db
    .delete(transactions)
    .where(
      and(eq(transactions.id, id), eq(transactions.userId, session.user.id)),
    );
  revalidatePath("/money");
  revalidatePath("/");
}

// ---------- Weekly budgets ----------

/** The saved budgets row for a week, or carry forward the nearest prior week. */
export async function getWeekBudgets(weekStart: string): Promise<BudgetRow> {
  const session = await requireSession();
  const saved = await db
    .select()
    .from(weeklyBudgets)
    .where(
      and(
        eq(weeklyBudgets.userId, session.user.id),
        eq(weeklyBudgets.weekStart, weekStart),
      ),
    )
    .limit(1);

  if (saved[0]) {
    const limits = await db
      .select()
      .from(categoryBudgets)
      .where(eq(categoryBudgets.weeklyBudgetId, saved[0].id));
    return {
      totalBudget: toNumber(saved[0].totalBudget),
      carriedForward: false,
      categoryLimits: limits.map((l) => ({
        categoryId: l.categoryId,
        limit: toNumber(l.limit) ?? 0,
      })),
    };
  }

  // No budget saved for this week yet — carry the most recent earlier week.
  const prior = await db
    .select()
    .from(weeklyBudgets)
    .where(
      and(
        eq(weeklyBudgets.userId, session.user.id),
        lt(weeklyBudgets.weekStart, weekStart),
      ),
    )
    .orderBy(desc(weeklyBudgets.weekStart))
    .limit(1);
  if (!prior[0]) {
    return { totalBudget: null, carriedForward: false, categoryLimits: [] };
  }
  const limits = await db
    .select()
    .from(categoryBudgets)
    .where(eq(categoryBudgets.weeklyBudgetId, prior[0].id));
  return {
    totalBudget: toNumber(prior[0].totalBudget),
    carriedForward: true,
    categoryLimits: limits.map((l) => ({
      categoryId: l.categoryId,
      limit: toNumber(l.limit) ?? 0,
    })),
  };
}

export async function setTotalBudget(weekStart: string, total: number | null) {
  const session = await requireSession();
  await db
    .insert(weeklyBudgets)
    .values({
      userId: session.user.id,
      weekStart,
      totalBudget: total == null || Number.isNaN(total) ? null : String(total),
    })
    .onConflictDoUpdate({
      target: [weeklyBudgets.userId, weeklyBudgets.weekStart],
      set: {
        totalBudget:
          total == null || Number.isNaN(total) ? null : String(Number(total).toFixed(2)),
        updatedAt: new Date(),
      },
    });
  revalidatePath("/money");
}

export async function setCategoryLimits(
  weekStart: string,
  limits: { categoryId: string; limit: number | null }[],
) {
  const session = await requireSession();

  // Ensure a budget row exists so category limits have a home.
  const [budget] = await db
    .insert(weeklyBudgets)
    .values({ userId: session.user.id, weekStart })
    .onConflictDoNothing({ target: [weeklyBudgets.userId, weeklyBudgets.weekStart] })
    .returning();
  const row =
    budget ??
    (await db
      .select()
      .from(weeklyBudgets)
      .where(
        and(
          eq(weeklyBudgets.userId, session.user.id),
          eq(weeklyBudgets.weekStart, weekStart),
        ),
      )
      .limit(1))[0];
  if (!row) return;

  await db.transaction(async (tx) => {
    // Remove category limits that are now cleared/nonexistent.
    const keepIds = limits
      .filter((l) => l.limit != null && !Number.isNaN(l.limit))
      .map((l) => l.categoryId);
    if (keepIds.length === 0) {
      await tx.delete(categoryBudgets).where(eq(categoryBudgets.weeklyBudgetId, row.id));
    } else {
      await tx
        .delete(categoryBudgets)
        .where(
          and(
            eq(categoryBudgets.weeklyBudgetId, row.id),
            notInArray(categoryBudgets.categoryId, keepIds),
          ),
        );
    }
    for (const l of limits) {
      if (l.limit == null || Number.isNaN(l.limit)) continue;
      await tx
        .insert(categoryBudgets)
        .values({
          weeklyBudgetId: row.id,
          categoryId: l.categoryId,
          limit: String(Number(l.limit).toFixed(2)),
        })
        .onConflictDoUpdate({
          target: [categoryBudgets.weeklyBudgetId, categoryBudgets.categoryId],
          set: { limit: String(Number(l.limit).toFixed(2)) },
        });
    }
  });
  revalidatePath("/money");
}

// ---------- Week summary ----------

export async function getWeekSummary(weekStart: string): Promise<WeekSummary> {
  const session = await requireSession();
  const start = weekStart || weekStartKey(todayKey());
  const end = shiftDayKey(start, 7);
  const startInst = new Date(`${start}T00:00:00`);
  const endInst = new Date(`${end}T00:00:00`);
  const today = todayKey();
  const todayInst = new Date(`${today}T00:00:00`);

  const [txs, cats, budget] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, session.user.id)),
    categoriesFor(session.user.id),
    getWeekBudgets(start),
  ]);

  const catById = new Map(cats.map((c) => [c.id, c.name]));
  const spentByCat = new Map<string, number>();
  let spent = 0;
  let income = 0;
  let spentToday = 0;

  for (const t of txs) {
    const at = new Date(t.occurredAt).getTime();
    if (at < startInst.getTime() || at >= endInst.getTime()) continue;
    const amt = toNumber(t.amount) ?? 0;
    const isExpense = t.type === "expense";
    if (isExpense) {
      spent += amt;
      const key = t.categoryId ?? "none";
      spentByCat.set(key, (spentByCat.get(key) ?? 0) + amt);
      if (at >= todayInst.getTime()) spentToday += amt;
    } else {
      income += amt;
    }
  }

  const budgetByCat = new Map(budget.categoryLimits.map((l) => [l.categoryId, l.limit]));

  const byCategory: WeekSummary["byCategory"] = [...catById.entries()].map(
    ([id, name]) => ({
      categoryId: id,
      name,
      spent: spentByCat.get(id) ?? 0,
      limit: budgetByCat.get(id) ?? null,
    }),
  );

  // Uncategorized expenses get a row so nothing silently vanishes.
  const uncategorizedSpent = spentByCat.get("none") ?? 0;
  if (uncategorizedSpent > 0) {
    byCategory.push({
      categoryId: null,
      name: "Uncategorized",
      spent: uncategorizedSpent,
      limit: null,
    });
  }
  byCategory.sort((a, b) => b.spent - a.spent);

  return {
    weekStart: start,
    spent,
    income,
    net: income - spent,
    spentToday,
    budget,
    byCategory,
  };
}

/** Compact carry of today's spend + remaining budget, for the Today page. */
export async function getTodayMoney() {
  const start = weekStartKey(todayKey());
  const summary = await getWeekSummary(start);
  const left = summary.budget.totalBudget != null ? summary.budget.totalBudget - summary.spent : null;
  const over = summary.budget.totalBudget != null ? summary.spent - summary.budget.totalBudget : 0;
  return {
    spentToday: summary.spentToday,
    left,
    over: over > 0 ? over : null,
  };
}