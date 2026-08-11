# Build Progress — Personal Growth OS

**Stack:** Next.js 16 (App Router, `src/` dir) · TypeScript · Tailwind 4 + shadcn/ui · Better Auth (email/password) · Drizzle ORM + `postgres-js` driver · Recharts. Dev DB = local Postgres; Neon for prod.

## Useful commands
- `npm run dev` — run app
- `npm run typecheck` — tsc --noEmit
- `npm run lint`
- `npm run db:generate` / `db:migrate` / `db:push` / `db:studio`
- `npm run db:auth:generate` — regenerate Better Auth schema into `src/db/auth-schema.ts`

## Env (.env.local, gitignored)
- `DATABASE_URL` = runtime (local: `postgresql://estifanos:peos_dev_local@127.0.0.1:5432/peos`)
- `DATABASE_URL_UNPOOLED` = migrations only
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=http://localhost:3000`

## Key decisions
- DB driver `postgres-js` (portable: works local + Neon pooled w/ `prepare:false`). NOT neon-http (HTTP driver can't reach local TCP).
- Day rollover = **4am local** via shared util; `DAY_ROLLOVER_HOUR = 4`.
- Groq AI: server-only `fetch` (no SDK), on-demand features, JSON-mode w/ shared `callGroq` helper that returns `null` on any failure so the app degrades; missing `GROQ_API_KEY` hides feature buttons entirely. Voice transcription uses Groq Whisper (`whisper-large-v3-turbo`) via `transcribeAudio`.
- Voice notes audio stored **base64-in-DB** (no blob storage); flagged in the Voice section for a future serverless move.
- PWA: **final polish phase**, after dashboard.
- shadcn/ui + sonner toasts + light-first calm theme.

## Progress log (newest first)

### DONE — PWA Polish (Installable + Offline, `9c281da`)
PWA is installable and has an offline-capable shell on top of the pre-existing manifest/sw.js/icons. Verified in a **prod build** (headless at 390px): SW registers, `/manifest.webmanifest` 200 with icons, hashed `_next/static` chunks get runtime-cached, a visited page (`/proof`) reloads fully offline, an unvisited route (`/time`) serves the branded offline page, zero console errors. Gates clean (typecheck/lint/build).

- **`public/sw.js` v2:** skip-redirect precache of the shell (`/`, `/offline.html`, `/manifest.webmanifest`, icons); **network-first navigations** → cached shell → `/offline.html`; **stale-while-revalidate** runtime cache for hashed `_next/static` assets (JS/CSS/woff2 — versioned by Next so never stale across deploys); pass-through for `/api/` + cross-origin; `SKIP_WAITING` message handler. Cache name bumped (`peos-shell-v2` / `peos-runtime-v2`) so the change force-activates.
- **`public/offline.html`:** minimal branded fallback with retry button.
- **`src/proxy.ts`:** exempts `/manifest.webmanifest` + `/offline.html` from the auth gate (they were 307→`/login`, and the SW precache was caching the login page under those URLs). `src/app/manifest.ts`: added `id`, `scope`, `display_override`, `orientation`, `categories`, `lang`.
- **Root layout:** `appleWebApp` metadata (→ `mobile-web-app-capable`, `apple-mobile-web-app-title`, status-bar style; this Next version emits the modern `mobile-web-app-capable` tag) + `formatDetection` (no phone-number auto-links).
- **Install/update UX:** `useInstallPrompt` (`beforeinstallprompt`/`appinstalled`) + `InstallButton` (Download icon) shown in the desktop header and at the bottom of the mobile drawer ("Add peos to your home screen"). `sw-register` now toasts **"Update available — Reload"** (`SKIP_WAITING` → `controllerchange` auto-reload).
- **Env note:** the seatflow docker stack (another project) took ports 3000 and 5432; peos dev runs on **3001** and prod-rebuilds are verified on **3002**, both against a dedicated `peos-postgres` container on **5433** (env overrides only, nothing committed). `NEXT_PUBLIC_*` and `BETTER_AUTH_*` are baked at build time, so a prod verify needs `NEXT_PUBLIC_APP_URL`/`BETTER_AUTH_URL` set during `npm run build` AND `npm run start`, and the prod server must be (re)started against the same `.next`.

### DONE — Responsive Shell (Mobile/Tablet/Desktop)
App is fully responsive from 320px (iPhone SE) up to desktop with a new mobile drawer nav. Verified headless at 320×568, 390px, 768px, 820px, 1024px, 1280px: zero horizontal overflow on all 13 feature pages, drawer opens/navigates/closes with active states, inline nav hides <md. Gates clean (typecheck/lint/build).

- **Mobile nav (`src/components/nav/mobile-nav.tsx`, new):** Base UI Dialog slide-in drawer (`w-72 max-w-[85vw]`) with all 13 links, active-state highlight via `usePathname`, closes on link click; hamburger trigger only shows <768px (`md:hidden`).
- **Shell (`(app)/layout.tsx`):** header nav wraps below `md` (`flex flex-wrap py-3 md:h-14`); inline `NavLinks` live in a scrollable `overflow-x-auto` container hidden <md; right-side cluster (theme/name/sign-out) is `shrink-0`; user name shows at `lg+` only.
- **Nav/scrolling:** `nav-links.tsx` drops `flex-wrap` (whitespace-nowrap inside the scroll container) so the 13 links never overflow at tablet widths.
- **Shared day/week nav:** `day-nav.tsx`, `time-log-app.tsx` DayNav, `weekly-plan.tsx` all `flex flex-wrap` with the label `min-w-40 flex-1 sm:flex-none` so prev/next/back stay reachable at 320px.
- **Touch accessibility:** every `opacity-0 group-hover:opacity-100` action (readers, today task delete, proof delete, plan hover actions, money delete) gained `focus-visible:opacity-100` / `focus-within:opacity-100`.
- **Narrow-row truncation:** `min-w-0` + `truncate` on money budget strings, fasting ranges, learn topics, analytics category names, daily-plan task spans — no `overflow-hidden` hacks.
- **Form/grid collapse:** money stats `grid-cols-1 sm:grid-cols-3`, money dialog fields `sm:grid-cols-2`, timeline start/end `sm:grid-cols-2`, today mini-stats `sm:grid-cols-4`, money weekly-budget label/input full-width rows, voice record/status + note rows `flex-wrap`, audio `w-32 sm:w-64`.
- Committed as `333487e`.

### DONE — Library (Book Reader, PDF/EPUB)
In-app book library with client-side PDF/EPUB rendering, position tracking, statuses, notes, and Learning Log / Proof Log shortcuts. New nav item **Library** (`/library`, `/library/[id]`). Schema **0014** applied: `books`, `book_notes` (+ `book_format`, `book_status` enums). All gates clean (typecheck/lint/build) + all routes 200; upload + file-stream routes auth-gated (anon → 303/307 redirect).

- **Fullscreen mode:** a "Fullscreen / Exit fullscreen" toggle in the reader header expands the reader card to fill the viewport via the Fullscreen API (webkit-prefixed fallbacks for Safari). The fullscreen card becomes a fixed, full-bleed overlay (`fullscreen:` Tailwind variant). PDF re-renders on container resize with a higher scale cap (2.5 vs 1.6) so pages fill the screen; EPUB re-paginates via `rendition.resize` on host resize — both wired through a `ResizeObserver` (debounced). Verified headless: `document.fullscreenElement` toggles set/unset, PDF canvas 691→1080 wide, EPUB host 958→1246 wide, zero console errors.

- **Storage (flagged):** no blob storage exists, so book files are stored **as base64 in the `books.file` column** (same pattern as voice notes; 50MB cap enforced server-side with a clear 413). `fileUrl` = `/api/library/file/{id}`, a GET route streaming bytes with the real MIME + private cache. Swap to S3/Tigris later.
- **Schema (0014):** `books` (id, userId, title, author nullable, fileUrl, file, mime, fileSize, format pdf|epub, totalPages nullable — populated once pdf.js reports it, currentPage, currentLocation text for EPUB CFI, progress 0..1, status unread|reading|finished, addedAt, lastOpenedAt nullable, indexed on userId). `book_notes` (id, bookId cascade, userId, page nullable, content, createdAt).
- **EPUB position decision:** epub.js uses CFI locations, not page numbers, so EPUBs track position in `currentLocation` (CFI string) + `progress`; PDFs use `currentPage`/`totalPages`. Both map to the same debounced `savePosition` action.
- **Upload route:** `POST /api/library/upload` (multipart title/author/file) validates PDF/EPUB by extension+MIME, caps at 50MB (413 with message), returns `{id}`.
- **Reader (`/library/[id]`):** PDF via `pdfjs-dist` (canvas pages, prev/next/jump, auto `totalPages` report); EPUB via `epubjs` (paginated rendition, prev/next, CFI relocation + progress %). Position saved debounced (~600ms), never per render. Status auto-updates unread→reading on open (`markOpened`); **finished is manual only** (Mark finished button).
- **Notes panel:** add a note optionally tagged to the current page (PDF), list/edit/delete.
- **Shortcuts:** "Log as learning" pre-fills topic=book title + content reference (user writes the entry, saves via `createLog`); "Save as proof" pre-fills a proof entry referencing the book (user confirms/edits, saves via `addProof`).
- **Deps added:** `pdfjs-dist`, `epubjs`. Worker vendored to `public/pdf.worker.min.mjs`; eslint now ignores `public/**`.

### DONE — Voice Notes (Recording, Transcription, Entry-Attached Clips)
Browser `MediaRecorder` recordings stored in Postgres + transcribed via Groq Whisper (multilingual, auto language — Amharic/English). Schema 0012 applied: `voice_categories`, `voice_notes` (+ `voice_note_status` enum); **schema 0013** added `entry_voices` (+ `entry_owner_kind` enum) + made `learning_logs.content` / `proof_entries.text` nullable for voice-only entries. All gates clean (typecheck/lint/build) + all routes 200; `/voice` and `/api/voice/audio/[id]` auth-gated.

- **Storage decision (flagged):** no blob storage exists, so audio is stored **as base64 in the `voice_notes.audio` column** (least new infra). `audioUrl` = `/api/voice/audio/{id}`, a GET route that streams bytes back with the real MIME + private cache. `mime` column added for correct playback. Swap to S3/Tigris if this ever moves to a serverless host.
- **Schema (0012):** `voice_categories` (id, userId, name, sortOrder) lazy-seeded per user with **Feeling, Technical, Random Thought, Idea, Rant** (like time categories, no color). `voice_notes` (id, userId, categoryId nullable set-null, audioUrl, audio, mime, transcript, transcriptStatus pending|done|failed|skipped, durationSeconds, note caption). Indexed on userId.
- **Recording:** `src/components/voice/use-recorder.ts` → getUserMedia + MediaRecorder (`audio/webm;codecs=opus` fallback webm/mp4), base64 file-reader, duration from timestamps, **soft-cap ~12 min auto-stop**. Mic-permission rejection shown inline, never blocks the page.
- **/voice page:** Record/Stop toggle + optional category select (show a "Categories..." manager dialog that adds/removes, mirrors the time CategoriesManager) + preview `<audio>` with duration + Save/Discard. Notes list (newest first): play/pause `<audio controls src={audioUrl}>`, category tag, duration, timestamp, editable caption + editable category (inline edit), delete. Transcript shown below once present. Statuses: **pending** "Transcribing…", **done** shows transcript, **failed** "Transcription failed — try again", **skipped** "No transcript yet. — Transcribe" button. **Search** over transcripts.
- **Transcription is user-triggered everywhere now:** recording saves audio **only** (status `skipped`); no auto-transcribe. Per-note **Transcribe** button → `transcribeNoteNow(id)` action → `transcribeStoredNote()` → `transcribeAudio()` in `src/lib/ai/groq.ts`: POST `/v1/audio/transcriptions`, model `whisper-large-v3-turbo`, **no language param → auto-detect**, `response_format json`, 60s timeout, `null` on any failure → status flips to `failed`. Saving never depends on transcription. `aiConfigured()` gates: when no key, notes save fine and no Transcribe button renders.
- **Entry-attached clips (learn/proof/review):** replaced the auto-transcribe dictate button with `VoiceClipButton` (`src/components/voice/voice-clip.tsx`) — records a clip **without transcribing**; an explicit "Transcribe to text" button optionally fills the field. Clips are uploaded after the entry exists via `POST /api/entry-voice` (multipart: ownerKind, ownerId, field, file; replaces per-field) → `src/lib/entry-voice.ts` `insertEntryVoice()` (status `skipped`). Saved clips render via `EntryClipList` (`src/components/voice/entry-clip-list.tsx`) with play + optional Transcribe + remove (`transcribeEntryClipNow` / `deleteEntryClip` in `voice/actions.ts`, streaming via `GET /api/entry-voice/[id]`). `src/lib/client-attach-clip.ts` `attachClip()` uploads a pending clip. Save actions (`createLog`/`updateLog`, `addProof`, `saveReview`) now return the entry id; learn/review/proof entries can be **text, voice, or both** (nullable text columns for voice-only). `src/components/voice/voice-dictate.tsx` deleted.
- GOTCHA: `blobToBase64` needs `blob.type` set or Playback breaks; server actions swallow File→ pass base64 string + mime instead of FormData; unescaped `'` triggers `react/no-unescaped-entities` in JSX — write `&apos;`.
- Verified: `db:generate` 0012+0013 applied; roundtrip insert→`GET /api/voice/audio/[id]` 200 with correct MIME via signed-in cookie; `POST /api/entry-voice` attach→`GET /api/entry-voice/[id]` streams byte-identical, re-attach replaces (1 row/field), anon → 307 /login; typecheck/lint/build clean; all routes 200.

### DONE — Groq AI Integration (Learning Suggestions, Proof Summarizer, Review Pattern-Spotter)
Real Groq calls now back three on-demand features. Schema 0011 applied: `growth_summaries` (id, user_id, content, created_at + index). All gates clean (typecheck/lint/build) + all routes 200 (auth-gated → /login).

- **Verdict note: AI is deliberately server-only + graceful-degrade.** No Groq key → feature buttons hide entirely; app fully works. A failed/empty call returns quietly (insufficient-history messages, never errors).
- **`src/lib/ai/groq.ts`:** single shared `callGroq<Shape>(system, user, jsonMode?)` — plain `fetch` to `https://api.groq.com/openai/v1/chat/completions`, model `llama-3.3-70b-versatile`, 15s abort timeout, `temperature 0.2`, `cache: no-store`. JSON-mode sends `response_format:{type:"json_object"}`+`json:true` and strips code fences before parse. Returns `null` on missing key / non-2xx / malformed JSON so callers degrade, never crash. `isGroqConfigured()` = `Boolean(process.env.GROQ_API_KEY)` (server-only). No `groq-sdk`.
- **Feature 1 — Learning suggestions (/learn):** `src/lib/learning-suggestions.ts` now = first 3 slots (user topic pool + rotating categories) + up to 2 AI suggestions (STRICT JSON `{suggestions:[{topic,reason}]}`) drawn from the user's last 10 learning-log entries (reversed newest-last); requires ≥3 history rows or falls back to more rotating categories so it always yields 5. `ai` items shown with a "suggested for you" tag + one-line reason. `getSuggestionsForDay` in `learn/actions.ts` passes real history now.
- **Feature 2 — Growth summarizer (proof):** "Summarize my growth" button (`aiConfigured()`-gated) → on-demand `summarizeGrowth()`: reads ≤40 proof entries + last-30-day night-review wins (day-key window via `shiftDayKey(todayKey(), -30)`), needs ≥3 entries OR ≥3 wins else returns null; plain-text 2-3 paragraph calm summary rendered inline w/ timestamp + "Save summary" → persists to `growth_summaries` (browser newest-first list in "Past summaries"). Buttons gated on `isGroqConfigured()`.
- **Feature 3 — Review pattern-spotter:** "Find patterns" button (gated) → `findReviewPatterns()`: last 30 night reviews formatted with energy/wins/improve/next, needs ≥7 reviews → quiet "not enough data yet" message otherwise; JSON `{patterns:[{pattern,evidence}]}` → 2-4 cards.
- **Files:** new `src/lib/ai/groq.ts`, `src/components/proof/proof-app.tsx` (plus SummaryCard + past-summaries list), `src/components/review/review-app.tsx` (+PatternCard), actions extended in `src/app/(app)/proof/actions.ts` & `review/actions.ts`. Env: optional `GROQ_API_KEY` (`.env.example` note; no key → buttons hidden).
- Verified: db:generate → 0011, migrate applied; typecheck/lint/build clean; all routes 200.
- GOTCHA: `react-hooks/set-state-in-effect` flags the earlier ESLint-disable-as-unused combo — the disable belongs directly above the `load()` call line inside the effect; `or` import must be trimmed when not used.

### DONE — Money Management (Expenses, Income, Weekly Budgets)
Full money feature, single currency ETB. Schema 0010 applied: `expense_categories`, `transactions` (type enum expense|income, amount numeric(12,2), categoryId nullable set-null, occurredAt tz), `weekly_budgets` (user+weekStart unique, totalBudget nullable), `category_budgets` (budget+category unique, limit). Gates clean (typecheck/lint/build) + all 11 routes incl /money 200.

- **Money page (/money):** quick-entry card (ETB presets 50–500 + amount input + category select), full add/edit EntryDialog (type expense|income, amount, category for expenses, note, datetime-local), week summary cards (spent/income/net stats, total-budget progress bar with honest "over by X ETB" in destructive red, "spent today"), per-category spend vs category limits rows (red when over), Weekly budget editor (total + per-category limits, inline list + save — Weekly Anchors UX), transactions list searchable by note/amount + filterable by type/category, editable/deletable.
- **Weekly budgets:** setTotalBudget + setCategoryLimits (upsert on unique keys, delete-stale-limits via notInArray); getWeekBudgets carries forward the nearest prior week's budget as a default (`carriedForward` flag surfaced in UI) but fully editable.
- **Today Growth column:** added "Spent today: X ETB · Y ETB left this week" line (or "over by X ETB this week" in red when over; "no budget set" when none), links to /money. New `getTodayMoney` action.
- **Analytics:** "Spend this week" card (expenses by category, reuse the "where your time went" Bar pattern) + 8-week trend row gained a "Spend (ETB)" TrendCell. `Analytics.money = { totalSpent, byCategory }`.
- **Formatting:** `src/lib/format.ts` `formatETB()` → "Br 1,250" (en-ET grouping), used everywhere.
- **Files:** `src/db/tables/money.ts` (relations + exports), `src/app/(app)/money/{actions.ts,page.tsx}`, `src/components/money/money-app.tsx`, nav link in `nav-links.tsx`.
- GOTCHA: drizzle `$defaultFn` generates ids JS-side → raw-SQL inserts need explicit id (schema itself fine). `ilike` on numeric column fails in PG → cast `sql\`${amount}::text\``. Syncing state from props via useEffect trips set-state-in-effect → use `key={weekStart}` remount + lazy useState initializers instead.

### DONE — Dark Mode
next-themes wired end-to-end (the `.dark` CSS vars were already in globals.css; `@custom-variant dark` already present).
- `src/components/theme/theme-provider.tsx`: NextThemesProvider `attribute="class"`, defaultTheme system, enableSystem, disableTransitionOnChange.
- `src/app/layout.tsx`: wrapped body in ThemeProvider; `suppressHydrationWarning` on `<html>`.
- `src/components/theme/theme-toggle.tsx`: ghost button toggling light/dark based on `resolvedTheme` (Sun/Moon icons).
- Toggle added to `(app)` header (next to Sign Out) and `(auth)` layout top-right.
- Verified: typecheck/lint clean; `/` and `/login` 200.

### DONE — Growth Features (Proof Log, Explain-It-Back, Anchor Stats, Energy Tags)
Four additive features completed. Schema 0009 applied: `proof_entries` table (+ proof_source enum manual|auto), `time_entries.energy` smallint nullable, `learning_logs.explain_back` text nullable. All gates clean (typecheck/lint/build) + all routes incl `/proof` 200.

- **Proof Log:** `/proof` page (add textarea + save, reverse-chrono list w/ delete-on-hover, ilike search). Nav link added in `src/components/nav/nav-links.tsx`. Actions @ `src/app/(app)/proof/actions.ts`: getProof, searchProof, addProof, addProofFromReview, deleteProof, getProofCount, getRandomProof. Today Growth column now shows "Proof" count mini-stat + a quiet random "Remember:" reminder.
- **Night-review "Save as proof":** after a save where energy ≥ 4 and "went well" is set, show inline suggestion to keep that win as proof (auto source) + "View" link to /proof. In `src/components/review/review-app.tsx`.
- **Explain-It-Back:** `learning_logs` gets nullable `explainBack`; optional 2nd form field "Teach it back (optional)"; shown as a rounded inset box in history. createLog/updateLog accept optional explainBack. `src/lib/learning-row.ts` carries it.
- **Energy tags:** `time_entries.energy` (1-5 nullable, validEnergy normalizes). Selector on live timer stop, in the add/backfill EntryDialog, and edit dialog; shown as `energy X/5` in list; both create/update/stop actions accept it.
- **Analytics:** new cards — "Anchors followed through: X/Y (rate)" and "Energy by category" (avg 1-5 + block count, sorted). `getAnalytics` returns `week.{anchors,anchorsFollowed}` + `energy.byCategory`.
- Verified: `db:generate` → 0009_absent_the_hand.sql, `db:migrate` applied; typecheck/lint/build clean; `/ /proof /learn /analytics /time` all 200.
- GOTCHA re-hit: `react-hooks/set-state-in-effect` disable goes directly above the `load()` line inside the effect (not above `useEffect`), else "unused directive"; unused `cn` import removed.

### Overhaul — Today page is a real working surface
`/` (Today) rebuilt from summary-with-links into a functional surface, split Today = action / Growth = reflection.
- **Today column:** embedded live TimerCard (start/stop, ticking via reused timer), interactive inline Daily Plan task list (check + add + delete), tickable habit checkboxes (toggleHabit, streak label, 4am day), and a wrap-up night-review link.
- All reuses existing actions/components (plan, time, habits, dashboard) — no new tables.
- Kept Growth column (weekly anchors + mini-stats from getGrowthSnapshot).
- Verified: typecheck/lint/build clean; all 9 routes 200.
- New file: `src/components/today/today-app.tsx`; `page.tsx` now renders it.

### Earlier stabilization pass (Prompt 1) — 4 bug fixes
- Category selects (timer + backfill) now resolve display name, not UUID, by passing `selectedName` as explicit `SelectValue` child.
- Fasting active timer now shows live countdown w/ percentage ("Xh Ym left · N% of goal") + real progress bar (off `startAt`+goal).
- Navbar active-tab indicator via client `src/components/nav/nav-links.tsx` (usePathname, `aria-current`, bold + underline).
- Daily Plan weekly anchors are now editable inline (reused `setAnchors`), keeping Week page editing too.

## Progress log (newest first)

### Phase 10 — PWA Polish (DONE)
- Icons: src/app/icon.svg + generated PNGs (sharp) → public/icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png.
- src/app/manifest.ts → served at /manifest.webmanifest (standalone, dark theme, maskable icon).
- src/app/layout.tsx: added manifest + icon/apple metadata, viewport themeColor/width/scale.
- public/sw.js: cached app-shell (precache shell+icons), never caches /api or dynamic app pages; nav requests go network.
- src/components/pwa/sw-register.tsx: registers /sw.js in production only (client).
- Verified: manifest + sw.js return 200; all 9 app routes 200; build/lint/typecheck clean.

### Phase 9 — Split Dashboard (DONE)
No new tables. `/` now renders DashboardApp (client), replacing the placeholder.
- Today card: plan done/total w/ bar, habits done/total, learning count, night review saved?, fasting running? — each row links to its feature.
- Growth card: this week's anchors (followed = has follow-through note) w/ link to set if none, habits active / learnings / reviews mini-stats, week-reviewed hint.
- Actions @ src/app/(app)/dashboard/actions.ts: getTodaySnapshot, getGrowthSnapshot — compose existing feature actions + light direct reads (learning/review counts).
- Verified: page 200, build/lint/typecheck clean.

### Phase 8 — Analytics (DONE)
No new tables (reads existing). /analytics: AnalyticsApp.
- This-week aggregate from all features: time logged (by category, overlap-aware w/ live-timer skip), habits days done (≤today), daily-plan done rate, learning entries, fasting hours/windows (overlap), night reviews count + avg energy (week-scoped).
- 8-week trend bars (habits %, time h, learnings) — pure CSS, no Recharts.
- Actions @ src/app/(app)/analytics/actions.ts: getAnalytics(weekStart?), getAnalyticsRange(8).
- Verified: page 200, build/lint/typecheck clean.

### Phase 7 — Fasting Tracker (DONE)
Schema m8 (0008) applied: `fasting_windows` (start_at, end_at null=active, goal_hours, note).
- /fasting: FastingApp — Start form (goal chips 8–24h + No goal, note), Active timer (elapsed, progress bar vs goal), Break fast, History w/ durations + goal-met highlight, delete.
- Actions @ src/app/(app)/fasting/actions.ts: getActiveFast, startFast (single-active guard), stopFast, deleteFast, listFasts.
- startFast accepts `number | null` goal.
- Verified: page 200, single-active + start/stop roundtrip + duration math via DB script.

### Phase 6 — Habit Tracker (DONE)
Schema m7 (0007) applied: `habits` (name, description, archived), `habit_logs` (habit_id+day_key unique, cascade delete).
- src/lib/habits.ts: `computeStreak` (today-or-yesterday aware) verified (3 / 2-ongoing / 0-broken / 0).
- /habits: HabitsApp — toggle-today rows (4am day), per-habit streak label, Add habit dialog, 13-week Activity heatmap (Mon–Sun columns, month labels, count-intensity levels, legend).
- Actions @ src/app/(app)/habits/actions.ts: listHabits (with doneToday+streak), createHabit, deleteHabit, toggleHabit (upsert/del), getHeatmap (91d).
- Rollover: `todayKey(DAY_ROLLOVER_HOUR)` for toggles; heatmap boundary accounts for rollover.
- Verified: page 200, streak math unit-checked, unique on (habit,day) holds (dupe insert blocked).

### Phase 5 — Night Review (DONE)
Schema m6 (0006) applied: `night_reviews` (unique user+day_key; wins, improve, nextMove, energy 1–5).
- /review: ReviewApp — energy picker (1–5, clearable), 3 text fields, save (upsert via onConflictDoUpdate), Past reviews w/ live search + click-to-open a day.
- Actions @ src/app/(app)/review/actions.ts: getReview, saveReview, listReviews, searchReviews.
- SaveReviewInput fields accept `string | null` (DB returns null; server normalizes with ?.trim() || null).
- Verified: page 200, build/lint/typecheck clean.

### Phase 4 — Daily Learning Log (DONE)
Schema m5 (0005) applied: `learning_topics` (user pool), `learning_logs` (learn_date, topic, content, source enum suggestion|user|ai).
- src/lib/learning-suggestions.ts: 5/day deterministic suggestions — user topics first + rotating dev-category window (day-of-year offset). `aiSuggestAsync` stubbed → returns [] (ai source exists but never produces yet).
- /learn: LearningApp — suggestion picker (source badge), topic+content form, today's log, history w/ live search (ilike topic/content), "Manage topics" dialog. Saved entries editable (Edit loads row into the form → Update), in both today's log and search history. Each entry can hold text, a voice clip, or both (clip per content / explainBack field).
- Actions @ src/app/(app)/learn/actions.ts: getSuggestions, getDayLog, createLog, updateLog, deleteLog, searchLogs, listTopics/addTopic/removeTopic, aiConfigured.
- Moved shared `LearningLogRow` type + mapper to src/lib/learning-row.ts (server files can't export non-async).
- Base UI Dialog: uses `render` prop, NOT asChild.
- Verified: page 200, suggestion rotation math, user-first ordering, build/lint/typecheck clean.

### Phase 3 — Weekly Plan (DONE)
Schema m4 (0004) applied: `weekly_plans` (user_id+week_start unique, reviewed), `weekly_anchors` (plan FK, text, sort_order, follow_through).
- time.ts week utils: weekStartKey(Monday), shiftWeekKey, weekDays.
- /week: WeeklyPlanApp. Week nav, 3–5 anchor editor (cap 5), Weekly review (per-anchor followThrough + mark reviewed/undo).
- /plan: Daily Plan now shows read-only "This week's anchors" header (getWeekAnchorsForDay wired).
- Actions @ src/app/(app)/week/actions.ts (setAnchors preserves follow-through on unchanged text, setFollowThrough, unreview).
- Verified: page 200, anchors insert/order, weekStartKey Monday math, build/lint/typecheck clean.

### Phase 2 — Daily Plan (DONE)
Schema m2+ (0002,0003) applied: `daily_plans` (user_id+day_key unique), `daily_plan_tasks` (plan_id FK, text, completed, sort_order).
- /plan: DailyPlanApp (client). DayNav (shared component src/components/day-nav.tsx), add/toggle/delete/move tasks, done counter, anchors reference header placeholder (wired in Phase 3).
- Actions @ src/app/(app)/plan/actions.ts. Ownership-scoped mutations (ownedPlanId join check) — resolves unused-session lint + correct authz.
- BUG FIXED: schema used `uniqueIndex` on tasks.plan_id (1 task/plan max) → changed to plain `index`; regenerated 0003.
- Verified: page 200 renders, add/toggle/move/delete via DB script, build/lint/typecheck clean.

### Phase 1 — Time Log (DONE)
Schema m1 (0001) applied: `time_categories` (name/color/sort_order), `time_entries` (start_at/end_at timestamptz; end_at null = live timer).
- /time: client-driven TimeLogApp. Live TimerCard (start/stop, elapsed ticking), retro "Add block" EntryDialog, Timeline day view (lane-assigned horizontal blocks + per-cat totals + editable list), CategoriesManager (add/remove, lazy-seeds 7 defaults).
- Server Actions @ src/app/(app)/time/actions.ts (start/stop/create/update/delete, listCategories). Day boundaries computed client-side (correct tz). Edit/delete everywhere.
- Verified: page 200 renders, categories seeded in DB, build + lint + typecheck clean.
- GOTCHA: 'use server' files can only export async fns (no `export const`/`export type`). Next16 strict react-hooks/set-state-in-effect flags fetch-on-mount → one targeted eslint-disable.
- DB driver switched to postgres-js (portable local+Neon), NOT neon-http.

### Phase 0 — DONE (auth verified end-to-end)
Verified via curl against local dev server:
- signup 200 + session cookie set
- get-session returns valid session
- protected `/` renders app shell with nav + session user name + dashboard placeholder (200)
- proxy guards: anonymous /time,/plan,/habits,/analytics,/learn → 307 /login; /login,/signup public 200; signed-in GET /login → 307 /
- sign-in (existing user) 200
- lint clean; typecheck clean
- Existing test row: test@peos.local / password123 (user Pk0zrYgCpVsyHPsWsdFPO0p4hlPxl1qk)
- NOTE: curl sign-out returns 415/400 (header quirk) — UI SignOutButton uses authClient.signOut() which works. Not a bug.

### Phase 0 — Foundation (IN PROGRESS)
- [x] shadcn/ui init (neutral grayscale, base-nova style, base-ui components). Added: button,input,label,card,separator,dialog,select,textarea,calendar,popover,sonner
- [x] sonner + next-themes installed
- [x] Auth flow code: (auth) group (login/signup pages + client forms), (app) layout w/ nav + requireSession, SignOutButton, `src/lib/session.ts` DAL (getSession/requireSession, React cache)
- [x] Root layout: metadata, Toaster mounted; removed boilerplate page.tsx
- [ ] BUG: proxy.ts `getSessionCookie` returns undefined — my cookiePrefix `peos` makes cookie name `peos.session_token`, but getSessionCookie defaults to `better-auth` name. Need to pass cookiePrefix.
- [x] proxy.ts moved root -> src/ (Next 16 w/ src needs it under src/)
- [ ] Full end-to-end verify auth via curl (signup worked; fix cookie prefix, then re-test reading session in protected page)
- [ ] App shell layout + primitives + calm theme
- [ ] Verify: signup/signin/session/protection/signout

### RESTART/TEST NOTE
- Dev server: start via `setsid nohup npm run dev > /tmp/peos-dev.log 2>&1 < /dev/null &` (survives shell tool ends). Current server running.
- Test user exists in local DB: test@peos.local / password123
- curl signup worked; cookie valid (get-session 200). BUT proxy redirect inverted → see BUG above.

### Phase 0 — Earlier (all done)
- [x] Scaffolded create-next-app (Next 16.3, React 19.2, Tailwind 4, npm)
- [x] Installed: drizzle-orm, drizzle-kit, postgres, @neondatabase/serverless (unused), better-auth, @better-auth/drizzle-adapter, dotenv, zod
- [x] `.env`/`.env.local`/`.env.example` written
- [x] Local Postgres running on 5432; DB `peos` created; role `estifanos` password `devpi_dev_local` set for TCP
- [x] `drizzle.config.ts` (DATABASE_URL_UNPOOLED), db scripts in package.json
- [x] `src/db/index.ts` (db singleton) — **needs switch neon-http -> postgres-js**
- [x] `src/db/auth-schema.ts` generated via @better-auth/cli (user/session/account/verification + relations)
- [x] `src/db/schema.ts` re-exports auth-schema (compose point for app tables)
- [x] Next 16 docs read: proxy.md (middleware→proxy), authentication.md patterns
- [ ] SWITCH db/index.ts to postgres-js + update .env.local to local URLs
- [ ] Run first migration (auth tables) against peos db
- [ ] `src/lib/auth.ts` finalize + verify (already written, uses @/db)
- [ ] Auth flow: /auth/login, /auth/signup pages
- [ ] proxy.ts guard
- [ ] signout + nav session
- [ ] App shell layout + shadcn init + primitives + calm theme
- [ ] Verify: signup/signin/session/protection/signout

### Phase 1..8 (pending)
time log -> daily plan -> weekly plan -> learning log -> night review -> habits -> fasting -> analytics -> dashboard -> PWA

## Notes / gotchas
- `better-auth`'s CLI resolves `src/lib/auth.ts` as config automatically; keep it import-safe (schema must exist) when regenerating.
- postgres influence: use `{ prepare: false }` when pointed at Neon pooled URL.
- drizzle-kit loads `.env` (dotenv/config). Real secrets live in `.env.local` for the app; for migrations ensure `.env` has the working URL too.