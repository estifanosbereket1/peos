"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { Analytics } from "@/app/(app)/analytics/actions";
import {
  getAnalytics,
  getAnalyticsRange,
} from "@/app/(app)/analytics/actions";
import { formatETB } from "@/lib/format";

export function AnalyticsApp() {
  const [current, setCurrent] = useState<Analytics | null>(null);
  const [trend, setTrend] = useState<Analytics[]>([]);

  const load = useCallback(async () => {
    const [c, t] = await Promise.all([getAnalytics(), getAnalyticsRange(8)]);
    setCurrent(c);
    setTrend(t);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (!current) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Analytics · week of {current.weekStart}</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Time logged" value={formatHours(current.time.totalMinutes)} />
        <Stat
          label="Habits done"
          value={`${current.habits.daysDone}/${current.habits.totalDays}`}
        />
        <Stat label="Tasks done" value={rate(current.plan.done, current.plan.total)} />
        <Stat label="Learn entries" value={String(current.learning.entries)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Anchors followed through</CardTitle>
          <CardDescription>
            Of this week&apos;s anchors, how many did you honestly own at the
            weekly review.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {current.week.anchors === 0 ? (
            <p className="text-sm text-muted-foreground">
              No anchors set this week.
            </p>
          ) : (
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-medium tabular-nums">
                {current.week.anchorsFollowed}/{current.week.anchors}
              </span>
              <span className="text-sm text-muted-foreground tabular-nums">
                {rate(current.week.anchorsFollowed, current.week.anchors)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Where your time went</CardTitle>
          <CardDescription>
            Sum of tracked time this week, by category.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {current.time.byCategory.length === 0 ||
          current.time.totalMinutes === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tracked time this week yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {current.time.byCategory.map((c) => (
                <li key={c.name} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ background: c.color }}
                      />
                      {c.name}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {formatMinutes(c.minutes)}
                    </span>
                  </div>
                  <Bar
                    value={c.minutes}
                    max={current.time.byCategory[0].minutes}
                    color={c.color}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Energy by category</CardTitle>
          <CardDescription>
            Average felt energy (1-5) across tracked blocks this week.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {current.energy.byCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No energy ratings yet this week.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {current.energy.byCategory.map((c) => (
                <li key={c.name} className="flex items-center gap-2 text-sm">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: c.color }}
                  />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {c.avg}/5 · {c.entries} blocks
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Spend this week</CardTitle>
          <CardDescription>Expenses by category, ETB.</CardDescription>
        </CardHeader>
        <CardContent>
          {current.money.byCategory.length === 0 || current.money.totalSpent === 0 ? (
            <p className="text-sm text-muted-foreground">
              No spending recorded this week.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {current.money.byCategory.map((c) => (
                <li key={c.name} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{c.name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {formatETB(c.spent)}
                    </span>
                  </div>
                  <Bar
                    value={c.spent}
                    max={current.money.byCategory[0].spent}
                    color="#8a8f98"
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Last 8 weeks</CardTitle>
          <CardDescription>Habit days · time · learning · spend.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-4">
            <TrendCell
              values={trend.map((w) => w.habits.totalDays ? w.habits.daysDone / w.habits.totalDays : 0)}
              label="Habits"
              fmt={(v) => `${Math.round(v * 100)}%`}
            />
            <TrendCell
              values={trend.map((w) => w.time.totalMinutes)}
              label="Time (h)"
              fmt={(v) => formatHours(v)}
            />
            <TrendCell
              values={trend.map((w) => w.learning.entries)}
              label="Learnings"
              fmt={(v) => String(v)}
            />
            <TrendCell
              values={trend.map((w) => w.money.totalSpent)}
              label="Spend (ETB)"
              fmt={(v) => formatETB(v)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-0.5 py-4">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-2xl font-medium tabular-nums">{value}</span>
      </CardContent>
    </Card>
  );
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.max(4, pct)}%`, background: color }}
      />
    </div>
  );
}

function TrendCell({
  values,
  label,
  fmt,
}: {
  values: number[];
  label: string;
  fmt: (v: number) => string;
}) {
  const max = useMemo(() => Math.max(...values, 1), [values]);
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex h-24 items-end gap-1.5">
        {values.map((v, i) => (
          <div
            key={i}
            className="flex flex-1 flex-col justify-end self-stretch"
            title={fmt(v)}
          >
            <div
              className="rounded-sm bg-primary/70"
              style={{ height: `${Math.max(4, (v / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function formatMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatHours(min: number) {
  return `${Math.round((min / 60) * 10) / 10}h`;
}

function rate(done: number, total: number): string {
  return total === 0 ? "0%" : `${Math.round((done / total) * 100)}%`;
}