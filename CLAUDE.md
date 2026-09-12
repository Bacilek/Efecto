# CLAUDE.md — Efecto

Context for AI assistants working on this repo. Read this first; it saves the
user re-explaining the project every session.

## What Efecto is

A **minimalist, mobile-first efficiency app**. The long-term goal is one app that
replaces a pile of productivity tools:

1. **Routine / habit tracker** — the core, built first. Weekly grid.
2. **Todos** — built-in task lists (next).
3. **Calendar** — events + a day view (after todos).
3b. **Timetable** — a weekly school timetable (built alongside; see below).
4. Later: cloud sync across devices, reminders/notifications, stats.

Design language: minimal, calm, dark, a bit "paper + brass". No clutter, few
colours, large tap targets. Think a quiet dashboard, not a busy app.

Distribution: **installable PWA now**, **Google Play app later** via Capacitor
(iOS possible but not a priority).

## Conventions

- **Everything is English** — UI text included. (It used to be a Czech UI; the
  user asked for English on 2026-09-12. `src/db/seed.ts` keeps the original
  Czech routine names in `LEGACY_EMOJI` for the one-time emoji backfill.)
- No i18n framework — strings are inline in the components.
- Package manager: **npm**. Node 20 LTS.
- Path alias `@/` → `src/`.
- Formatting: Prettier (no semicolons, single quotes, width 100). Lint: ESLint
  flat config. Keep `npm run lint` and `npm run build` clean.
- Styling: Tailwind only, tokens in `tailwind.config.js`. Don't add a component
  library — hand-roll the few shared bits in `src/ui/`.
- **Commit + push after every logical change** (the user asked for this
  explicitly). Small, focused commits. English messages with the repo's standard
  trailers. `origin` = https://github.com/Bacilek/Efecto.git, branch `main`.

## Structure

```
src/
  main.tsx  App.tsx            # shell: screen state + <BottomNav>
  index.css                    # Tailwind layers, safe-area handling
  app/BottomNav.tsx            # Routines | Todos | Calendar | Timetable | Settings
  lib/date.ts                  # week math; weekday index 0=Mon..6=Sun (NOT JS getDay)
  lib/cn.ts
  lib/time.ts                  # "HH:MM" <-> minutes since midnight
  db/db.ts                     # Dexie schema v2 (routines, entries, lessons, meta)
  db/seed.ts                   # default routines, inserted once when empty
  features/
    routines/                  # THE feature — see below
    timetable/                 # school timetable — see below
    todos/  calendar/  settings/
  ui/                          # ScreenHeader, EmptyState, ...
```

## Routine tracker — how it works

Layout: **rows = 7 days (Mon–Sun) of the selected week, columns = routines.**
Horizontally scrollable; day column and header row are sticky. Today's row is
highlighted. `WeekNav` moves between weeks, clamped by `useWeek` to the calendar year
containing today — back to the week holding 1 January, forward to the week
holding 31 December (`canPrev` / `canNext` grey the arrows out at the edges).
An edge week may spill into the neighbouring year; the limit is the week, not
the date.

Data (`db/db.ts`):
- `Routine { id, name, emoji?, order, activeDays: WeekdayIndex[], time?, archived, createdAt }`
  - `emoji` optional single emoji, shown as the column header (falls back to `name`).
  - `activeDays` = which weekdays it applies to (0=Mon..6=Sun).
  - `order` primary column sort, set by dragging the header cells.
  - `time` optional "H:MM", legacy — only a tie-breaker after `order`
    (`compareRoutines`). No UI writes it any more; seed still sets it.
- `Entry { id: "${routineId}|${dateISO}", routineId, date, status, updatedAt }`
  - Only explicit marks are stored. No entry = pending (or off / derived-missed).

Cell state (`features/routines/status.ts` → `resolveCellState`):
1. weekday not in `activeDays` → **off** (grey `–`, not tappable)
2. entry exists → its status: **done** / **busy** / **missed**
3. no entry, date < today → **missed** (derived — this is the "auto red at end of
   day" behaviour, done at render time, no cron/service worker)
4. no entry, today or later → **pending**

Tap cycles the status (`nextStatus`). 1 tap = done (green), 2 = missed (red),
3 = busy (blue).
- Today / future: `undefined → done → missed → busy → undefined` (empty box).
- **Past**: an unmarked cell already renders red, so the empty step is invisible
  there and is dropped — the cycle rotates over the *visible* state,
  `missed → busy → done → missed`. A past cell keeps an entry once marked;
  cleared and `missed` are identical on screen and in the stats.

`busy` means **excused**, not failed: "couldn't be done for a good reason"
(ill, travelling). It is neither pass nor fail — see the stats below.

`RoutineEditor` (bottom sheet): emoji, name, 7 weekday toggles ("Active on"), delete (also wipes
that routine's entries). New routine via the "+ rutina" header
button ("+ routine"). Drag a column header sideways to reorder: the grabbed icon follows the
pointer 1:1 while the other columns slide to their live target slots
(`visualRoutines` = `arrayMove` by `round(dx / colWidth)`); on drop `onReorder`
rewrites every `order` and the overlay is held until the persisted order matches.

Completion stats (`features/routines/stats.ts`): `pct = done / counted` where
"counted" = every cell that is neither `off` nor `busy`. `missed` and
past-unmarked count against it; **`busy` drops out of the ratio entirely**, like
an off-day, so an excused skip can neither raise nor lower the percentage.
`total === 0` → `pct === 100` (`toPct`): a day with no routines scheduled, or one
where every routine was excused, leaves nothing outstanding and reads as 100 %. Each day row shows its `%` under the date; a bar under `WeekNav` shows the
week total (`weekCompletion` = sum over the 7 days).

Live data via `dexie-react-hooks` `useLiveQuery` — mutations just write to Dexie
and the grid re-renders.

## Timetable — how it works

A weekly template, Mon–Fri, 08:00–20:00 (`features/timetable/layout.ts` owns
that window: `DAY_START`, `DAY_END`, `DAYS`, `PX_PER_MIN`). It repeats every
week and holds no dates, so it needs no `Entry` equivalent.

Layout: **rows = the 5 weekdays, the horizontal axis is time** — the same
reading direction as the routine grid. Horizontally scrollable with a sticky
day-label gutter (`GUTTER`). One minute is one pixel, so an hour is 60px and the
grid is 720px wide by 260px tall: the whole week fits on a phone without
vertical scrolling, and a two-hour lesson is 120px — wide enough for its code
and room.

- `Lesson { id, name, kind, group?, room?, day, start, end, createdAt }` — `day`
  is 0=Mon..4=Fri, `start`/`end` are "HH:MM" inside the window.
- `kind` is `lecture` | `seminar` | `lab` — the user's L / C / LAB — and picks the
  block colour (green / yellow / blue, tokens `lecture` / `seminar` / `lab`).
  `KIND_LABELS`, `KIND_NAMES` and `KIND_STYLES` in `layout.ts` are the single
  source for all three.
- `name` is the bare subject code ("PV170"); `group` is the seminar group that
  follows the slash in "MB142/09". The grid renders them as `name/group`.
- Absolute positioning, not a CSS grid: `placeDay` converts each lesson to
  `left`/`width` in pixels from its minutes. Lessons that overlap in time stack
  within the row's height, so a clash stays visible instead of hiding one block
  behind another.
- Tap an empty slot to add a lesson prefilled with that hour (`hourAt` snaps the
  tap down to the hour, capped at `DAY_END - 60`); tap a lesson to edit it.
  `LessonEditor` is a bottom sheet mirroring `RoutineEditor`.
- A vertical brass **"now" line** marks the current time to the minute in
  today's row, and everything to its left is dimmed (`bg-ink/60` above the
  blocks, `pointer-events-none` so it never eats a tap): whole rows for earlier
  weekdays, a partial one for today. `nowMarker` / `elapsedWidth` in `layout.ts`
  do the maths; `lib/useNow.ts` re-renders every 30 s.
  - Both go quiet at the **weekend** — the timetable is a weekday template, so
    there is no row to point at, and greying all five days from Saturday morning
    would say nothing useful.
  - Outside 08:00–20:00 there is no line; the shading still applies (before
    08:00 nothing of today is dimmed, after 20:00 all of it is).
- `SEED_TIMETABLE` in `db/seed.ts` holds the user's real timetable, inserted
  once by `seedTimetableIfEmpty()` when the `lessons` table is empty (same
  atomic-transaction + in-flight-promise guard as `seedIfEmpty`, for the same
  <StrictMode> reason). Editing or deleting lessons afterwards sticks.

## Not yet done / known simplifications

- `archived` flag exists but nothing sets it (delete is hard-delete).
- Timetable: colour comes from `kind` only (no per-subject colours), no teacher
  field, no week A/B parity, and it isn't linked to the calendar or to routines.
- Todos / Calendar are stubs.
- No sync, no auth, no notifications.
- Capacitor: only `capacitor.config.ts`; `android/` not generated (needs Android
  Studio + JDK 17). Steps in README.

## Verify a change

```bash
npm run lint && npm run build
npm run dev   # then use a mobile viewport in devtools
```
Check: grid renders 7 day rows + routine columns, today highlighted, past-unmarked
cells red, off-days grey `–`, tap cycles colours and **survives reload**, week
nav keeps per-week marks, editor add/edit/delete works.
