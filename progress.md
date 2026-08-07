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
- AI learning suggestions: **stubbed** — `source` column accepts `suggestion|user|ai`, provider returns nothing in v1.
- PWA: **final polish phase**, after dashboard.
- shadcn/ui + sonner toasts + light-first calm theme.

## Progress log (newest first)

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
- /learn: LearningApp — suggestion picker (source badge), topic+content form, today's log, history w/ live search (ilike topic/content), "Manage topics" dialog.
- Actions @ src/app/(app)/learn/actions.ts: getSuggestions, getDayLog, createLog, updateLog (unused for now), deleteLog, searchLogs, listTopics/addTopic/removeTopic.
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