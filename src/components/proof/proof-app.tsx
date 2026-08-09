"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { VoiceClipButton, type PendingClip } from "@/components/voice/voice-clip";
import { EntryClipList } from "@/components/voice/entry-clip-list";
import { attachClip } from "@/lib/client-attach-clip";

import {
  addProof,
  aiConfigured,
  deleteProof,
  getProof,
  searchProof,
  summarizeGrowth,
  saveGrowthSummary,
  listGrowthSummaries,
  type GrowthSummaryRow,
} from "@/app/(app)/proof/actions";

type ProofRow = {
  id: string;
  text: string | null;
  source: "manual" | "auto";
  createdAt: Date;
};

export function ProofApp() {
  const [text, setText] = useState("");
  const [clip, setClip] = useState<PendingClip | null>(null);
  const [rows, setRows] = useState<ProofRow[]>([]);
  const [query, setQuery] = useState("");
  const [aiOn, setAiOn] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setRows(await getProof());
  }, []);

  const checkAi = useCallback(async () => {
    const configured = await aiConfigured();
    setAiOn(configured);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    checkAi();
  }, [load, checkAi]);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Proof log</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="relative">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What did you do? Something that actually happened — no vibes."
              rows={2}
              className="pr-9"
            />
            <div className="absolute right-1.5 top-1.5">
              <VoiceClipButton
                onClipChange={setClip}
                onTranscribe={(t) => {
                  const sep = text.trim() ? "\n" : "";
                  setText(text.trim() + sep + t.trim());
                }}
              />
            </div>
          </div>
          {clip && (
            <p className="text-xs text-muted-foreground">
              Voice clip attached — will be saved with this entry.
            </p>
          )}
          <Button
            className="self-start"
            disabled={(!text.trim() && !clip) || saving}
            onClick={() => {
              void (async () => {
                setSaving(true);
                const id = await addProof(text);
                if (id && clip) {
                  await attachClip("proof", id, "text", clip);
                }
                setText("");
                setClip(null);
                await load();
                setSaving(false);
              })();
            }}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </CardContent>
      </Card>

      {aiOn && <SummaryCard />}

      <Card>
        <CardHeader>
          <CardTitle>{rows.length} entries kept</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search proof…"
              className="pl-8"
            />
          </div>
          {query ? (
            <SearchResults query={query} />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing yet. What did you get done?
            </p>
          ) : (
            <ProofList
              rows={rows}
              aiReady={aiOn}
              onDelete={async (id) => {
                await deleteProof(id);
                await load();
              }}
              onChanged={load}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [savedRows, setSavedRows] = useState<GrowthSummaryRow[]>([]);

  const loadSaved = useCallback(async () => {
    setSavedRows(await listGrowthSummaries());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSaved();
  }, [loadSaved]);

  async function summarize() {
    if (loading) return;
    setLoading(true);
    const res = await summarizeGrowth();
    setLoading(false);
    setResult(res?.text ?? null);
    setSaved(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Growth summary</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button
          className="self-start"
          variant="outline"
          onClick={() => void summarize()}
          disabled={loading}
        >
          {loading ? "Summarizing…" : "Summarize my growth"}
        </Button>
        {result && (
          <div className="rounded-md border bg-muted/30 px-3 py-2.5">
            <p className="whitespace-pre-wrap text-sm">{result}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatDateTime(new Date())}
              </span>
              {!saved && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void (async () => {
                      await saveGrowthSummary(result);
                      setSaved(true);
                      await loadSaved();
                    })();
                  }}
                >
                  Save summary
                </Button>
              )}
            </div>
          </div>
        )}
        {!result && !loading && (
          <p className="text-sm text-muted-foreground">
            Needs at least a few proof entries or night-review wins. Only runs
            when you ask.
          </p>
        )}
        {savedRows.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Past summaries
            </p>
            <ul className="flex flex-col divide-y">
              {savedRows.map((s) => (
                <li key={s.id} className="flex flex-col gap-0.5 py-2">
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {s.content}
                  </p>
                  <span className="text-xs text-muted-foreground/70 tabular-nums">
                    {formatDateTime(s.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProofList({
  rows,
  aiReady,
  onDelete,
  onChanged,
}: {
  rows: ProofRow[];
  aiReady: boolean;
  onDelete: (id: string) => void;
  onChanged?: () => Promise<void>;
}) {
  return (
    <ul className="flex flex-col divide-y">
      {rows.map((r) => (
        <li key={r.id} className="group flex flex-col gap-2 py-2.5">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              {r.text && <p className="whitespace-pre-wrap text-sm">{r.text}</p>}
              <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                {r.createdAt.toLocaleDateString()}
                {r.source === "auto" ? " · kept" : ""}
                {!r.text ? " · voice entry" : ""}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={() => onDelete(r.id)}
              aria-label="Delete proof"
            >
              <Trash2 />
            </Button>
          </div>
          <EntryClipList
            ownerKind="proof"
            ownerIds={[r.id]}
            fields={["text"]}
            aiReady={aiReady}
            onChanged={onChanged}
          />
        </li>
      ))}
    </ul>
  );
}

function SearchResults({ query }: { query: string }) {
  const [rows, setRows] = useState<ProofRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    searchProof(query).then((r) => {
      if (alive) setRows(r);
    });
    return () => {
      alive = false;
    };
  }, [query]);

  if (!rows) return <p className="text-sm text-muted-foreground">Searching…</p>;
  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground">No matches.</p>;
  return <ProofList rows={rows} aiReady={false} onDelete={() => {}} />;
}

function formatDateTime(d: Date) {
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}