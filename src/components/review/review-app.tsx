"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { DayNav } from "@/components/day-nav";
import { VoiceClipButton, type PendingClip } from "@/components/voice/voice-clip";
import { EntryClipList } from "@/components/voice/entry-clip-list";
import { attachClip } from "@/lib/client-attach-clip";
import { addProofFromReview } from "@/app/(app)/proof/actions";
import {
  findReviewPatterns,
  getReview,
  listReviews,
  saveReview,
  searchReviews,
  aiConfigured as reviewAiConfigured,
  type ReviewPattern,
  type SaveReviewInput,
} from "@/app/(app)/review/actions";
import { todayKey } from "@/lib/time";

type Review = Omit<SaveReviewInput, "wins" | "improve" | "nextMove"> & {
  id?: string;
  wins?: string | null;
  improve?: string | null;
  nextMove?: string | null;
};

const ENERGY_OPTIONS = [1, 2, 3, 4, 5];

export function ReviewApp() {
  const [dayKey, setDayKey] = useState(() => todayKey());
  const [draft, setDraft] = useState<Review>({
    dayKey: todayKey(),
    wins: "",
    improve: "",
    nextMove: "",
    energy: null,
  });
  const [clips, setClips] = useState<Record<string, PendingClip | null>>({
    wins: null,
    improve: null,
    nextMove: null,
  });
  const [saving, setSaving] = useState(false);
  const [proofPrompt, setProofPrompt] = useState(false);
  const [proofSaved, setProofSaved] = useState(false);
  const [history, setHistory] = useState<Review[]>([]);
  const [aiOn, setAiOn] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [savedClipsReload, setSavedClipsReload] = useState(0);

  useEffect(() => {
    void reviewAiConfigured().then(setAiOn);
  }, []);

  const load = useCallback(async (key: string) => {
    const review = await getReview(key);
    setDraft({
      dayKey: key,
      wins: review?.wins ?? "",
      improve: review?.improve ?? "",
      nextMove: review?.nextMove ?? "",
      energy: review?.energy ?? null,
    });
    setDraftId(review?.id ?? null);
    setClips({ wins: null, improve: null, nextMove: null });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(dayKey);
  }, [dayKey, load]);

  useEffect(() => {
    listReviews().then((rows) =>
      setHistory(rows.map((r) => ({ ...r }))),
    );
  }, []);

  const hasContent = Boolean(
    draft.wins?.trim() ||
      draft.improve?.trim() ||
      draft.nextMove?.trim() ||
      clips.wins ||
      clips.improve ||
      clips.nextMove,
  );

  const attachAll = async (id: string) => {
    for (const [field, clip] of Object.entries(clips)) {
      if (clip) await attachClip("review", id, field, clip);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <DayNav dayKey={dayKey} onChange={setDayKey} label="Today" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Night review</CardTitle>
          <CardDescription>
            Close out the day. A few honest lines beat a perfect one.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="energy">How was the day?</Label>
            <div className="flex gap-1.5">
              {ENERGY_OPTIONS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setDraft({ ...draft, energy: v })}
                  className={cn(
                    "size-8 rounded-md border text-sm tabular-nums transition-colors",
                    draft.energy === v
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:bg-muted",
                  )}
                  aria-pressed={draft.energy === v}
                  aria-label={`Energy ${v} of 5`}
                >
                  {v}
                </button>
              ))}
              {draft.energy != null && (
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, energy: null })}
                  className="ml-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  clear
                </button>
              )}
            </div>
          </div>

          <ReviewField
            id="wins"
            label="What went well?"
            placeholder="A win, a highlight, something you finished…"
            value={draft.wins ?? ""}
            onChange={(v) => setDraft({ ...draft, wins: v })}
            clip={clips.wins}
            onClip={(c) => setClips({ ...clips, wins: c })}
          />
          <ReviewField
            id="improve"
            label="What could have been better?"
            placeholder="One thing you'd tweak…"
            value={draft.improve ?? ""}
            onChange={(v) => setDraft({ ...draft, improve: v })}
            clip={clips.improve}
            onClip={(c) => setClips({ ...clips, improve: c })}
          />
          <ReviewField
            id="next-move"
            label="Carry into tomorrow"
            placeholder="The one next step…"
            value={draft.nextMove ?? ""}
            onChange={(v) => setDraft({ ...draft, nextMove: v })}
            clip={clips.nextMove}
            onClip={(c) => setClips({ ...clips, nextMove: c })}
          />

          <Button
            className="self-start"
            disabled={!hasContent || saving}
            onClick={() => {
              void (async () => {
                setSaving(true);
                const id = await saveReview(draft);
                if (id) await attachAll(id);
                setSaving(false);
                setClips({ wins: null, improve: null, nextMove: null });
                setProofSaved(false);
                // Good day + recorded a win → offer to keep it as proof (not forced).
                setProofPrompt(
                  (draft.energy ?? 0) >= 4 && Boolean(draft.wins?.trim()),
                );
              })();
            }}
          >
            {saving ? "Saving…" : "Save review"}
          </Button>

          {draftId && (
            <EntryClipList
              key={`${draftId}-${savedClipsReload}`}
              ownerKind="review"
              ownerIds={[draftId]}
              fields={["wins", "improve", "nextMove"]}
              aiReady={aiOn}
              onChanged={async () => {
                await load(dayKey);
                setSavedClipsReload((n) => n + 1);
              }}
            />
          )}

          {proofPrompt && !proofSaved && draft.wins?.trim() && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                That&apos;s real proof. Keep the &quot;{draft.wins.trim()}&quot;
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void (async () => {
                    await addProofFromReview(draft.wins ?? "");
                    setProofSaved(true);
                  })();
                }}
              >
                Save as proof
              </Button>
            </div>
          )}
          {proofPrompt && proofSaved && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                Saved to your proof log.
              </span>
              <Link href="/proof" className="underline underline-offset-3 hover:text-foreground">
                View
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <HistoryCard
        onOpen={async (day) => {
          setDayKey(day);
          await load(day);
        }}
        initialHistory={history}
        aiReady={aiOn}
      />

      {aiOn && <PatternCard />}
    </div>
  );
}

function PatternCard() {
  const [loading, setLoading] = useState(false);
  const [patterns, setPatterns] = useState<ReviewPattern[] | null>(null);
  const [empty, setEmpty] = useState(false);

  async function find() {
    if (loading) return;
    setLoading(true);
    const p = await findReviewPatterns();
    setLoading(false);
    setPatterns(p);
    setEmpty(p.length === 0);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Patterns</CardTitle>
        <CardDescription>
          Recurring things across your last ~30 reviews. Runs only when you
          ask — needs at least 7 reviews to say anything honest.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button
          className="self-start"
          variant="outline"
          onClick={() => void find()}
          disabled={loading}
        >
          {loading ? "Looking…" : "Find patterns"}
        </Button>
        {patterns && patterns.length > 0 && (
          <ul className="flex flex-col gap-2">
            {patterns.map((p, i) => (
              <li key={i} className="flex flex-col gap-0.5 rounded-md border bg-muted/30 px-3 py-2">
                <p className="text-sm font-medium">{p.pattern}</p>
                <p className="text-sm text-muted-foreground">{p.evidence}</p>
              </li>
            ))}
          </ul>
        )}
        {empty && (
          <p className="text-sm text-muted-foreground">
            Not enough data yet — keep reviewing and check back after a few more
            entries.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ReviewField({
  id,
  label,
  placeholder,
  value,
  onChange,
  clip,
  onClip,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  clip: PendingClip | null;
  onClip: (c: PendingClip | null) => void;
}) {
  const insert = useCallback(
    (text: string) => {
      onChange((value.trim() ? `${value.trim()}\n` : "") + text.trim());
    },
    [value, onChange],
  );
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Textarea
          id={id}
          rows={3}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="pr-9"
        />
        <div className="absolute right-1.5 top-1.5">
          <VoiceClipButton onClipChange={onClip} onTranscribe={insert} />
        </div>
      </div>
      {clip && (
        <p className="text-xs text-muted-foreground">
          Voice clip attached — saved with this review.
        </p>
      )}
    </div>
  );
}

function HistoryCard({
  initialHistory,
  onOpen,
  aiReady,
}: {
  initialHistory: Review[];
  onOpen: (day: string) => void;
  aiReady: boolean;
}) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Review[]>(initialHistory);

  useEffect(() => {
    let alive = true;
    (query.trim() ? searchReviews(query) : listReviews()).then((r) => {
      if (alive) setRows(r.map((x) => ({ ...x })));
    });
    return () => {
      alive = false;
    };
  }, [query]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Past reviews</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reviews…"
            className="pl-8"
          />
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reviews yet.</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {rows.map((r) => (
              <li key={r.dayKey} className="flex flex-col gap-1 py-2.5">
                <button
                  type="button"
                  onClick={() => onOpen(r.dayKey)}
                  className="self-start text-sm font-medium hover:underline"
                >
                  {r.dayKey}
                  {r.energy != null && (
                    <span className="ml-2 text-muted-foreground">
                      {r.energy}/5
                    </span>
                  )}
                </button>
                {r.wins && (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Went well:</span>{" "}
                    {r.wins}
                  </p>
                )}
                {r.nextMove && (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Next:</span>{" "}
                    {r.nextMove}
                  </p>
                )}
                {r.id && (
                  <EntryClipList
                    ownerKind="review"
                    ownerIds={[r.id]}
                    fields={["wins", "improve", "nextMove"]}
                    aiReady={aiReady}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}