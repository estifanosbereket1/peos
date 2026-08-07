"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type {
  GrowthSnapshot,
  TodaySnapshot,
} from "@/app/(app)/dashboard/actions";
import {
  getGrowthSnapshot,
  getTodaySnapshot,
} from "@/app/(app)/dashboard/actions";

export function DashboardApp() {
  const [today, setToday] = useState<TodaySnapshot | null>(null);
  const [growth, setGrowth] = useState<GrowthSnapshot | null>(null);

  const load = useCallback(async () => {
    const [t, g] = await Promise.all([getTodaySnapshot(), getGrowthSnapshot()]);
    setToday(t);
    setGrowth(g);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Today</CardTitle>
          <CardDescription>What do I do now?</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {today ? (
            <>
              <MetricRow
                label="Plan"
                done={today.plan.done}
                total={today.plan.total}
                href="/plan"
              />
              <MetricRow
                label="Habits"
                done={today.habitsDone}
                total={today.habitsTotal}
                href="/habits"
              />
              <MetricRow
                label="Learned"
                done={today.learningEntries}
                total={null}
                href="/learn"
              />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Night review</span>
                <span
                  className={cn(
                    "flex items-center gap-1",
                    today.reviewSaved ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {today.reviewSaved ? "Saved" : "Not yet"}
                  <Link href="/review" aria-label="Open night review">
                    <ArrowRight className="size-3.5" />
                  </Link>
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Fasting</span>
                <span className="flex items-center gap-1 text-foreground">
                  {today.hasFasting ? "Running" : "Off"}
                  <Link href="/fasting" aria-label="Open fasting">
                    <ArrowRight className="size-3.5" />
                  </Link>
                </span>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Growth</CardTitle>
          <CardDescription>Am I actually growing?</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {growth ? (
            <>
              <div className="flex flex-col gap-1">
                <p className="text-sm text-muted-foreground">Weekly anchors</p>
                {growth.anchors.length === 0 ? (
                  <p className="text-sm">
                    <Link href="/week" className="underline underline-offset-3">
                      Set your anchors for this week
                    </Link>
                  </p>
                ) : (
                  <ul className="flex flex-col gap-0.5 text-sm">
                    {growth.anchors.map((a, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            a.followed ? "bg-primary" : "bg-muted-foreground/50",
                          )}
                        />
                        <span
                          className={cn(
                            a.followed && "text-muted-foreground line-through",
                          )}
                        >
                          {a.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <MiniStat
                  label="Habits active"
                  value={growth.habitsDone}
                  href="/habits"
                />
                <MiniStat
                  label="Learnings"
                  value={growth.learningEntries}
                  href="/learn"
                />
                <MiniStat label="Reviews" value={growth.reviews} href="/review" />
              </div>

              <p className="text-xs text-muted-foreground">
                {growth.anchorsReviewed
                  ? "Week reviewed — nice."
                  : "Review this week on the Week page."}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricRow({
  label,
  done,
  total,
  href,
}: {
  label: string;
  done: number;
  total: number | null;
  href: string;
}) {
  const pct = total && total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <Link href={href} className="group flex flex-col gap-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="flex items-center gap-1 tabular-nums">
          {total != null ? `${done}/${total} (${pct}%)` : String(done)}
          <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${Math.max(pct === 0 && done > 0 ? 4 : pct, 0)}%` }}
        />
      </div>
    </Link>
  );
}

function MiniStat({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-0.5 rounded-md border py-2 hover:bg-muted"
    >
      <span className="text-lg font-medium tabular-nums">{value}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </Link>
  );
}