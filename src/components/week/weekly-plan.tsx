"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { getWeek, setAnchors, setFollowThrough, unreview } from "@/app/(app)/week/actions";
import { shiftWeekKey, todayKey, weekDays, weekStartKey } from "@/lib/time";
import { cn } from "@/lib/utils";

const MAX_ANCHORS = 5;

type Anchor = { id: string; text: string; sortOrder: number; followThrough: string | null };

export function WeeklyPlanApp() {
  const [weekStart, setWeekStart] = useState(() => weekStartKey(todayKey()));
  const [reviewed, setReviewed] = useState(false);
  const [anchors, setAnchorsState] = useState<Anchor[]>([]);
  const [draft, setDraft] = useState<string[]>([]);
  const [reviewDraft, setReviewDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (ws: string) => {
    const res = await getWeek(ws);
    setReviewed(res.reviewed);
    setAnchorsState(res.anchors);
    setDraft(res.anchors.map((a) => a.text));
    setReviewDraft(
      Object.fromEntries(res.anchors.map((a) => [a.id, a.followThrough ?? ""])),
    );
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(weekStart);
  }, [weekStart, load]);

  const isCurrentWeek = weekStart === weekStartKey(todayKey());
  const days = weekDays(weekStart);

  async function saveAnchors() {
    setSaving(true);
    try {
      await setAnchors(weekStart, draft);
      await load(weekStart);
    } finally {
      setSaving(false);
    }
  }

  async function saveReview() {
    setSaving(true);
    try {
      await setFollowThrough(weekStart, reviewDraft);
      await load(weekStart);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekStart(shiftWeekKey(weekStart, -1))}>
            ←
          </Button>
          <span className="min-w-40 text-center text-sm font-medium">
            Week of {days[0].slice(5).replace("-", "/")} – {days[6].slice(5).replace("-", "/")}
          </span>
          <Button variant="outline" size="icon" onClick={() => setWeekStart(shiftWeekKey(weekStart, 1))}>
            →
          </Button>
          {!isCurrentWeek && (
            <Button variant="ghost" size="sm" onClick={() => setWeekStart(weekStartKey(todayKey()))}>
              This week
            </Button>
          )}
        </div>
        <span
          className={cn(
            "ml-auto rounded-full px-2.5 py-0.5 text-xs",
            reviewed ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          {reviewed ? "Reviewed" : "Not reviewed"}
        </span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weekly anchors</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            3–5 direction-level intentions. Not tasks — direction. They show
            quietly at the top of each daily plan this week.
          </p>
          {draft.map((text, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-5 text-right text-sm text-muted-foreground tabular-nums">
                {i + 1}
              </span>
              <Input
                value={text}
                onChange={(e) => {
                  const next = [...draft];
                  next[i] = e.target.value;
                  setDraft(next);
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDraft(draft.filter((_, j) => j !== i))}
                aria-label="Remove anchor"
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          {draft.length < MAX_ANCHORS && (
            <Button variant="outline" size="sm" onClick={() => setDraft([...draft, ""])}>
              <Plus /> Add anchor
            </Button>
          )}
          <Button
            disabled={saving || draft.filter((t) => t.trim()).length === 0}
            onClick={saveAnchors}
            className="self-start"
          >
            <Check /> Save anchors
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Weekly review</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Honest check at week&apos;s end: did each anchor get real attention?
          </p>
          {anchors.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Save anchors first — the review works against them.
            </p>
          ) : (
            anchors.map((a) => (
              <div key={a.id} className="flex flex-col gap-1.5">
                <p className="text-sm font-medium">{a.text}</p>
                <Textarea
                  placeholder="Did it get real attention?"
                  value={reviewDraft[a.id] ?? ""}
                  onChange={(e) =>
                    setReviewDraft((d) => ({ ...d, [a.id]: e.target.value }))
                  }
                  rows={2}
                />
              </div>
            ))
          )}
          <div className="flex gap-2">
            <Button
              disabled={saving || anchors.length === 0}
              onClick={saveReview}
            >
              {reviewed ? "Update review" : "Mark week reviewed"}
            </Button>
            {reviewed && (
              <Button variant="outline" onClick={async () => { await unreview(weekStart); await load(weekStart); }}>
                Undo review
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}