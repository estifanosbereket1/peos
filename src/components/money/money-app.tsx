"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Pencil, Plus, Search, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import {
  createTransaction,
  deleteTransaction,
  getTransactions,
  getWeekSummary,
  listCategories,
  searchTransactions,
  setCategoryLimits,
  setTotalBudget,
  updateTransaction,
  type CategoryRow,
  type TransactionRow,
  type WeekSummary,
} from "@/app/(app)/money/actions";
import { formatETB } from "@/lib/format";
import { shiftWeekKey, todayKey, weekStartKey } from "@/lib/time";

export function MoneyApp() {
  const [weekStart, setWeekStart] = useState(() => weekStartKey(todayKey()));
  const [summary, setSummary] = useState<WeekSummary | null>(null);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [txs, setTxs] = useState<TransactionRow[]>([]);
  const [editing, setEditing] = useState<TransactionRow | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    const [s, c, t] = await Promise.all([
      getWeekSummary(weekStart),
      listCategories(),
      getTransactions(),
    ]);
    setSummary(s);
    setCategories(c);
    setTxs(t);
  }, [weekStart]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const isCurrentWeek = weekStart === weekStartKey(todayKey());

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <WeekNav
          weekStart={weekStart}
          onChange={(key) => setWeekStart(key)}
        />
        {!isCurrentWeek && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setWeekStart(weekStartKey(todayKey()))}
          >
            Back to this week
          </Button>
        )}
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={() => setShowAdd(true)}>
            <Plus /> Add entry
          </Button>
        </div>
      </div>

      <QuickEntry categories={categories} onSaved={load} />

      <WeekSummaryCards summary={summary} />

      {summary && (
        <BudgetEditorCard
          key={weekStart}
          weekStart={weekStart}
          summary={summary}
          categories={categories}
          onSaved={load}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
          <CardDescription>
            Everything, newest first. Search, filter, edit, delete.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <HistoryList
            initial={txs}
            categories={categories}
            onEdit={(t) => setEditing(t)}
            onMutated={load}
          />
        </CardContent>
      </Card>

      {(showAdd || editing) && (
        <EntryDialog
          entry={editing}
          categories={categories}
          onClose={() => {
            setShowAdd(false);
            setEditing(null);
          }}
          onSaved={load}
        />
      )}
    </div>
  );
}

function WeekNav({
  weekStart,
  onChange,
}: {
  weekStart: string;
  onChange: (key: string) => void;
}) {
  const from = new Date(`${weekStart}T00:00:00`);
  const to = new Date(from.getTime() + 6 * 24 * 60 * 60 * 1000);
  const f = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={() => onChange(shiftWeekKey(weekStart, -1))}
        aria-label="Previous week"
      >
        ←
      </Button>
      <span className="min-w-44 text-center text-sm font-medium">
        {f(from)} – {f(to)}
      </span>
      <Button
        variant="outline"
        size="icon"
        onClick={() => onChange(shiftWeekKey(weekStart, 1))}
        aria-label="Next week"
      >
        →
      </Button>
    </div>
  );
}

function QuickEntry({
  categories,
  onSaved,
}: {
  categories: CategoryRow[];
  onSaved: () => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const selectedName = categories.find((c) => c.id === categoryId)?.name;

  async function save() {
    const amt = Number(amount);
    if (!amt || amt <= 0 || !categoryId || saving) return;
    setSaving(true);
    await createTransaction({
      type: "expense",
      categoryId,
      amount: amt,
      note: null,
      occurredAt: new Date().toISOString(),
    });
    setSaving(false);
    setAmount("");
    await onSaved();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick entry</CardTitle>
        <CardDescription>
          Spent right now — tap a preset or type the amount.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {[50, 100, 150, 200, 300, 500].map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAmount(String(a))}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm tabular-nums transition-colors",
                amount === String(a)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              )}
            >
              {a}
            </button>
          ))}
          <Input
            className="w-32"
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Amount in ETB"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={categoryId}
            onValueChange={(v) => setCategoryId(v ?? "")}
          >
            <SelectTrigger className="w-48" aria-label="Category">
              <SelectValue placeholder="Pick a category">{selectedName}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => void save()}
            disabled={!amount || !categoryId || saving}
          >
            {saving ? "Saving…" : `Save ${amount ? formatETB(Number(amount) || 0) : ""}`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function WeekSummaryCards({ summary }: { summary: WeekSummary | null }) {
  if (!summary) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  const { spent, income, net, spentToday, budget, byCategory } = summary;
  const totalLimit = budget.totalBudget;
  const overBudget = totalLimit != null && spent > totalLimit;
  const remaining = totalLimit != null ? totalLimit - spent : null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>This week</CardTitle>
          <CardDescription>
            {formatFromWeek(summary.weekStart)}
            {budget.carriedForward ? " · budget carried forward — edit below." : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <MiniStat label="Spent" value={formatETB(spent)} />
            <MiniStat label="Income" value={formatETB(income)} />
            <MiniStat
              label="Net"
              value={formatETB(net)}
              valueClass={net < 0 ? "text-destructive" : undefined}
            />
          </div>

          {totalLimit != null ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">
                  Budget {formatETB(totalLimit)}
                </span>
                <span
                  className={cn(
                    "tabular-nums",
                    overBudget
                      ? "font-medium text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  {overBudget
                    ? `over by ${formatETB(spent - totalLimit)}`
                    : `${formatETB(remaining!)} left`}
                </span>
              </div>
              <BudgetBar
                spent={spent}
                limit={totalLimit}
                over={overBudget}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No weekly budget set yet.
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Spent today
            </p>
            <p className="text-lg font-medium tabular-nums">
              {formatETB(spentToday)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Spend by category</CardTitle>
          <CardDescription>
            Each row against its category limit, if set.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {byCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No spending recorded this week.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {byCategory.map((c) => {
                const overCat = c.limit != null && c.spent > c.limit;
                return (
                  <li key={c.categoryId ?? "none"} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{c.name}</span>
                      <span
                        className={cn(
                          "tabular-nums",
                          overCat ? "text-destructive" : "text-muted-foreground",
                        )}
                      >
                        {formatETB(c.spent)}
                        {c.limit != null
                          ? overCat
                            ? ` · over ${formatETB(c.spent - c.limit)}`
                            : ` of ${formatETB(c.limit)}`
                          : ""}
                      </span>
                    </div>
                    {c.limit != null ? (
                      <BudgetBar spent={c.spent} limit={c.limit} over={overCat} />
                    ) : (
                      <div className="h-2 w-full rounded-full bg-muted" />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BudgetBar({
  spent,
  limit,
  over,
}: {
  spent: number;
  limit: number;
  over: boolean;
}) {
  const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full transition-all", over ? "bg-destructive" : "bg-primary/70")}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

function MiniStat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-md border py-2">
      <span className={cn("text-lg font-medium tabular-nums", valueClass)}>
        {value}
      </span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}

function BudgetEditorCard({
  weekStart,
  summary,
  categories,
  onSaved,
}: {
  weekStart: string;
  summary: WeekSummary | null;
  categories: CategoryRow[];
  onSaved: () => Promise<void>;
}) {
  const [total, setTotal] = useState<string>(
    summary?.budget.totalBudget != null ? String(summary.budget.totalBudget) : "",
  );
  const [limits, setLimits] = useState<Record<string, string>>(() => {
    const next: Record<string, string> = {};
    for (const l of summary?.budget.categoryLimits ?? []) {
      next[l.categoryId] = String(l.limit);
    }
    return next;
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) return;
    setSaving(true);
    const parsed = total.trim() === "" ? null : Number(total);
    await setTotalBudget(
      weekStart,
      parsed != null && Number.isFinite(parsed) && parsed > 0 ? parsed : null,
    );
    await setCategoryLimits(
      weekStart,
      categories.map((c) => ({
        categoryId: c.id,
        limit: limits[c.id]?.trim() ? Number(limits[c.id]) : null,
      })),
    );
    setSaving(false);
    await onSaved();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly budget</CardTitle>
        <CardDescription>
          Total for the week plus per-category limits. Last week&apos;s budget
          carries forward — edit freely.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Label className="w-32 text-sm" htmlFor="total-budget">
            Total budget
          </Label>
          <Input
            id="total-budget"
            type="number"
            inputMode="decimal"
            placeholder="e.g. 2500"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            className="w-40"
          />
          <span className="text-sm text-muted-foreground">ETB</span>
        </div>
        <div className="flex flex-col divide-y">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center gap-2 py-1.5">
              <span className="flex-1 text-sm">{c.name}</span>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="no limit"
                value={limits[c.id] ?? ""}
                onChange={(e) =>
                  setLimits((prev) => ({ ...prev, [c.id]: e.target.value }))
                }
                className="w-28"
                aria-label={`Limit for ${c.name}`}
              />
              <span className="text-xs text-muted-foreground">ETB</span>
            </div>
          ))}
        </div>
        <Button
          className="self-start"
          variant="outline"
          onClick={() => void save()}
          disabled={saving}
        >
          <Check /> {saving ? "Saving…" : "Save budget"}
        </Button>
      </CardContent>
    </Card>
  );
}

function HistoryList({
  initial,
  categories,
  onEdit,
  onMutated,
}: {
  initial: TransactionRow[];
  categories: CategoryRow[];
  onEdit: (t: TransactionRow) => void;
  onMutated: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | "expense" | "income">("");
  const [catFilter, setCatFilter] = useState("");
  const [filtered, setFiltered] = useState<TransactionRow[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const runSearch = useCallback(async () => {
    setSearching(true);
    const rows = await searchTransactions(query.trim() || undefined, {
      type: typeFilter || undefined,
      categoryId: catFilter || undefined,
    });
    setFiltered(rows);
    setSearching(false);
  }, [query, typeFilter, catFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    runSearch();
  }, [runSearch]);

  const visible = filtered ?? initial;
  const catSelected = categories.find((c) => c.id === catFilter)?.name;

  async function remove(id: string) {
    setDeletingId(id);
    await deleteTransaction(id);
    setDeletingId(null);
    await onMutated();
    setFiltered(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search note or amount…"
            className="pl-8"
          />
        </div>
        <Select
          value={typeFilter}
          onValueChange={(v) =>
            setTypeFilter((v ?? "") as "" | "expense" | "income")
          }
        >
          <SelectTrigger className="w-32" aria-label="Type">
            <SelectValue placeholder="All types">
              {typeFilter
                ? typeFilter === "expense"
                  ? "Expense"
                  : "Income"
                : "All types"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="expense">Expense</SelectItem>
            <SelectItem value="income">Income</SelectItem>
          </SelectContent>
        </Select>
        <Select value={catFilter} onValueChange={(v) => setCatFilter(v ?? "")}>
          <SelectTrigger className="w-40" aria-label="Category">
            <SelectValue placeholder="All categories">
              {catSelected ?? "All categories"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={""}>All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {searching ? (
        <p className="text-sm text-muted-foreground">Searching…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No transactions yet.</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {visible.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm">
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      t.type === "expense" ? "bg-primary" : "bg-emerald-600",
                    )}
                  />
                  <span className="truncate">
                    {t.categoryName ?? (t.type === "expense" ? "Uncategorized" : "Income")}
                  </span>
                  {t.note ? (
                    <span className="truncate text-muted-foreground"> · {t.note}</span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatDateTime(t.occurredAt)}
                </p>
              </div>
              <span
                className={cn(
                  "tabular-nums",
                  t.type === "expense"
                    ? "text-foreground"
                    : "text-emerald-700 dark:text-emerald-400",
                )}
              >
                {t.type === "expense" ? "–" : "+"}
                {formatETB(t.amount)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(t)}
                aria-label="Edit entry"
              >
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void remove(t.id)}
                disabled={deletingId === t.id}
                aria-label="Delete entry"
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EntryDialog({
  entry,
  categories,
  onClose,
  onSaved,
}: {
  entry: TransactionRow | null;
  categories: CategoryRow[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [type, setType] = useState<"expense" | "income">(entry?.type ?? "expense");
  const [amount, setAmount] = useState(entry ? String(entry.amount) : "");
  const [categoryId, setCategoryId] = useState(entry?.categoryId ?? "");
  const [note, setNote] = useState(entry?.note ?? "");
  const [occurredAt, setOccurredAt] = useState(
    entry ? toLocalInput(entry.occurredAt) : defaultNowInput(),
  );
  const [saving, setSaving] = useState(false);
  const selectedName = categories.find((c) => c.id === categoryId)?.name;

  async function save() {
    const amt = Number(amount);
    if (!amt || amt <= 0 || saving) return;
    if (type === "expense" && !categoryId) return;
    setSaving(true);
    const input = {
      type,
      categoryId: type === "income" ? null : categoryId,
      amount: amt,
      note,
      occurredAt: new Date(occurredAt).toISOString(),
    };
    if (entry) {
      await updateTransaction({ id: entry.id, ...input });
    } else {
      await createTransaction(input);
    }
    setSaving(false);
    await onSaved();
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o && !saving) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{entry ? "Edit entry" : "Add entry"}</DialogTitle>
          <DialogDescription>
            {entry ? "Fix anything you logged." : "Log a transaction."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["expense", "income"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm capitalize transition-colors",
                    type === t
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:bg-muted",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount">Amount (ETB)</Label>
              <Input
                id="amount"
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            {type === "expense" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cat">Category</Label>
                <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "")}>
                  <SelectTrigger id="cat">
                    <SelectValue placeholder="Pick a category">
                      {selectedName}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="when">When</Label>
            <Input
              id="when"
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">Note</Label>
            <Input
              id="note"
              placeholder="Optional — what was it?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={() => void save()}
            disabled={!amount || (type === "expense" && !categoryId) || saving}
          >
            {saving ? "Saving…" : entry ? "Save" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function defaultNowInput() {
  return toLocalInput(new Date());
}

function formatDateTime(d: Date) {
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFromWeek(weekStart: string) {
  const start = new Date(`${weekStart}T00:00:00`);
  const end = new Date(start.getTime() + 6 * 86400000);
  const f = (d: Date) =>
    d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  return `${f(start)} – ${f(end)}`;
}