# CLAUDE.md — Efecto

Context for AI assistants working on this repo. Read this first; it saves the
user re-explaining the project every session.

## What Efecto is

A **minimalist, mobile-first efficiency app**. The long-term goal is one app that
replaces a pile of productivity tools:

1. **Routine / habit tracker** — the core, built first. Weekly grid.
2. **Timetable** — a weekly school timetable. Done (v1); see below.
3. **Todos** — built-in task lists, grouped into folders. Done (v1); see below.
4. **Calendar** — events + a day view. **Next up.**
5. Later: cloud sync across devices, reminders/notifications, stats.

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
  lib/date.ts                  # week math; weekday index 0=Mon..6=Sun (NOT JS getDay);
                               # isoWeek / weekParity / weeksBetween
  lib/cn.ts
  lib/time.ts                  # "HH:MM" <-> minutes since midnight
  lib/useNow.ts                # clock hook, re-renders on an interval
  db/db.ts                     # Dexie schema v4 (routines, entries, lessons,
                               # todoFolders, todos, meta)
  db/seed.ts                   # default routines + the timetable, each inserted
                               # once when its table is empty; plus backfills
  features/
    routines/                  # THE feature — see below
    timetable/                 # school timetable — see below
                               # layout.ts (geometry) semester.ts occurrence.ts
    todos/  calendar/  settings/
  ui/                          # ScreenHeader, EmptyState, ...
```

## Routine tracker — how it works

Layout: **rows = 7 days (Mon–Sun) of the selected week, columns = routines.**
Horizontally scrollable; day column and header row are sticky. Today's row is
highlighted. `WeekNav` shows the selected week's **ISO week number and parity** ("Week 37 ·
odd", `isoWeek` / `weekParity` in `lib/date.ts`) under the date range, and moves
between weeks, clamped by `useWeek` to the calendar year
containing today — back to the week holding 1 January, forward to the week
holding 31 December (`canPrev` / `canNext` grey the arrows out at the edges).
An edge week may spill into the neighbouring year; the limit is the week, not
the date.

Data (`db/db.ts`):
- `Routine { id, name, emoji?, order, activeDays, time?, timesPerWeek?, weeks?, archived, createdAt }`
  - `emoji` optional single emoji, shown as the column header (falls back to `name`).
  - `activeDays` = which weekdays it applies to (0=Mon..6=Sun).
  - `timesPerWeek` turns the routine into a **weekly target** — see below.
  - `weeks` restricts it to odd or even **ISO** weeks (the parity `WeekNav`
    shows). A routine bound to the other parity resolves to `off` all week and
    its header emoji dims.
  - `order` primary column sort, set by dragging the header cells.
  - `time` optional "H:MM", legacy — only a tie-breaker after `order`
    (`compareRoutines`). No UI writes it any more; seed still sets it.
- `Entry { id: "${routineId}|${dateISO}", routineId, date, status, updatedAt }`
  - Only explicit marks are stored. No entry = pending (or off / derived-missed).

Cell state (`features/routines/status.ts` → `resolveCellState`):
1. `weeks` set and this week is the other parity → **off** for the whole week
2. `timesPerWeek` set → the entry's status, else **pending**. No day is owed, so
   every day is markable and **an unmarked past day is not a miss**
3. weekday not in `activeDays` → **off** (grey `–`, not tappable)
4. entry exists → its status: **done** / **busy** / **missed**
5. no entry, date < today → **missed** (derived — this is the "auto red at end of
   day" behaviour, done at render time, no cron/service worker)
6. no entry, today or later → **pending**

Tap cycles the status (`nextStatus`). 1 tap = done (green), 2 = missed (red),
3 = busy (blue).
- Today / future: `undefined → done → missed → busy → undefined` (empty box).
- **Past**: an unmarked cell already renders red, so the empty step is invisible
  there and is dropped — the cycle rotates over the *visible* state,
  `missed → busy → done → missed`. A past cell keeps an entry once marked;
  cleared and `missed` are identical on screen and in the stats.

`busy` means **excused**, not failed: "couldn't be done for a good reason"
(ill, travelling). It is neither pass nor fail — see the stats below.

**Weekly targets** (`timesPerWeek`, e.g. "gym 3× a week"): the obligation is the
week's count, not any particular day. So they are left out of `dayCompletion`
entirely — they can't move a single day's percentage — and counted once per week
in `weekCompletion` as `min(done marks, target) / target`. The cap stops a
fourth session pushing the week over 100 %. The column header shows `2/3`.

That is also why `nextStatus` takes **`clearsToMissed`**, not "is it past": the
empty step is only invisible where an empty cell derives red, which a weekly
target never does. `tapCell` asks `resolveCellState` what an empty cell would
render as rather than assuming.

`RoutineEditor` (bottom sheet): emoji, name, a **Schedule** picker ("Set days" →
7 weekday toggles, or "Times a week" → 1–7×), a **Repeats** row (every week /
odd / even), and delete (also wipes that routine's entries). New routine via the "+ routine" header button. Drag a column header sideways to reorder: the grabbed icon follows the
pointer 1:1 while the other columns slide to their live target slots
(`visualRoutines` = `arrayMove` by `round(dx / colWidth)`); on drop `onReorder`
rewrites every `order` and the overlay is held until the persisted order matches.

Completion stats (`features/routines/stats.ts`): `pct = done / counted` where
"counted" = every cell that is neither `off` nor `busy`. `missed` and
past-unmarked count against it; **`busy` drops out of the ratio entirely**, like
an off-day, so an excused skip can neither raise nor lower the percentage.
`total === 0` → `pct === 100` (`toPct`): a day with no routines scheduled, or one
where every routine was excused, leaves nothing outstanding and reads as 100 %.

Each day row shows its `%` under the date; a bar under `WeekNav` shows the week
total (`weekCompletion` = sum over the 7 days, not an average of them).

Live data via `dexie-react-hooks` `useLiveQuery` — mutations just write to Dexie
and the grid re-renders.

## Timetable — how it works

A weekly template, Mon–Fri, 08:00–20:00 (`features/timetable/layout.ts` owns
that window: `DAY_START`, `DAY_END`, `DAYS`, `SPAN`). It repeats every week and
holds no dates of its own — only the per-date exceptions below.

Layout: **rows = the 5 weekdays, the horizontal axis is time** — the same
reading direction as the routine grid. Horizontal offsets are **percentages**
(`pctOfDay`, `SPAN`), so all of 08:00–20:00 always fits the viewport exactly and
nothing scrolls in either direction; only the day-label gutter (`GUTTER`) and the
row height are fixed pixels. The trade-off is narrow blocks: on a 360px phone an
hour is ~25px and a two-hour lesson ~50px, so long codes truncate. Going back to
a fixed pixels-per-minute scale with sideways scrolling is a one-constant
change.

Labels are centred on what they label: an hour number sits over its own column
(`HOUR_PCT` wide, so the 19 doesn't overflow the right edge) and a day label is
centred in the `GUTTER`. Today's row is tinted `bg-today` with its label in
brass, matching the routine grid — but only in the current week (`showNow`).

- `Lesson { id, name, kind, group?, room?, day, start, end, skipDates?, onlyDates?, createdAt }`
  - `day` is 0=Mon..4=Fri, `start`/`end` are "HH:MM" inside the window.
- `weeks` restricts a lesson to odd or even **semester** weeks (the parity
  `SemesterNav` shows), set from the editor's "Repeats" row. A mismatched week
  renders the lesson as a ghost, like any other exception.
- `kind` is `lecture` | `seminar` | `lab` — the user's L / C / LAB — and picks the
  block colour (green / yellow / blue, tokens `lecture` / `seminar` / `lab`).
  `KIND_LABELS`, `KIND_NAMES` and `KIND_STYLES` in `layout.ts` are the single
  source for all three.
- `name` is the bare subject code ("PV170"); `group` is the seminar group that
  follows the slash in "MB142/09". The grid renders them as `name/group`.
- Absolute positioning, not a CSS grid: `placeDay` converts each lesson to
  `left`/`width` percentages from its minutes. Lessons that overlap in time stack
  within the row's height, so a clash stays visible instead of hiding one block
  behind another.
- Tap an empty slot to add a lesson prefilled with that hour (`hourAt` snaps the
  tap down to the hour, capped at `DAY_END - 60`); tap a lesson to edit it.
  `LessonEditor` is a bottom sheet mirroring `RoutineEditor`.
- A vertical brass **"now" line** marks the current time to the minute in
  today's row, and everything to its left is dimmed (`bg-ink/60` above the
  blocks, `pointer-events-none` so it never eats a tap): whole rows for earlier
  weekdays, a partial one for today. `nowMarker` / `elapsedPct` in `layout.ts`
  do the maths; `lib/useNow.ts` re-renders every 30 s.
  - Both go quiet at the **weekend** — the timetable is a weekday template, so
    there is no row to point at, and greying all five days from Saturday morning
    would say nothing useful.
  - Outside 08:00–20:00 there is no line; the shading still applies (before
    08:00 nothing of today is dimmed, after 20:00 all of it is).
- `SemesterNav` above the grid pages through the semester's weeks and shows the
  **semester week, its parity and its Mon–Fri dates**. `useSemesterWeek` clamps
  paging to weeks 1..`semesterWeekCount()`; the centre button jumps back to the
  current week.
  - `features/timetable/semester.ts` holds `SEMESTER_START` / `SEMESTER_END` as
    hard-coded dates that **need editing once per semester** (currently
    2026-09-14 → 2026-12-18, which is 14 weeks). The start must be a Monday; the
    end may fall anywhere inside the last week.
  - The lessons never change — the timetable is a template with no dates — so
    paging only moves the label, the parity and whether the "now" marker
    applies (`showNow`, true only for the week we're actually in).
  - `semesterWeek` returns null outside the semester. Then the view defaults to
    week 1, the jump-to-now button is disabled and no marker is drawn.
- **Per-date exceptions** (`occurrence.ts`) break the weekly rhythm:
  `Lesson.skipDates` cancels individual dates, `Lesson.onlyDates` restricts the
  lesson to a list. `happensOn` applies three rules in a fixed order —
  `onlyDates` wins outright (naming a date is the most explicit thing there is),
  then `skipDates`, then `weeks` parity. Note that *having* `onlyDates` makes it
  a whitelist, so an empty one means "never runs" — otherwise cancelling the
  last listed date would flip the lesson back to weekly.
  - A lesson that doesn't happen that week is still drawn, as a **ghost**
    (dashed, struck through, dimmed) and still tappable — otherwise a lesson
    with `onlyDates` would be uneditable in every other week.
  - The editor's `OccurrenceRow` cancels or restores just the tapped date via
    `toggledOccurrence`, writing immediately and closing: acting on one
    occurrence is a different gesture from editing the weekly lesson.
  - `placeWeek(lessons, dates)` needs that week's Mon–Fri dates to resolve any
    of this; without them every lesson counts as happening.
- `SEED_TIMETABLE` in `db/seed.ts` holds the user's real timetable, inserted
  once by `seedTimetableIfEmpty()` when the `lessons` table is empty (same
  atomic-transaction + in-flight-promise guard as `seedIfEmpty`, for the same
  <StrictMode> reason). Editing or deleting lessons afterwards sticks.
- `backfillLessonExceptions()` applies the seeded exceptions to timetables that
  already existed before those fields did, matching on code + weekday + start
  since ids differ per install. Guarded by a `meta` flag; skips any lesson that
  already has exceptions.

## Todos — how it works

Dateless tasks: anything with a fixed day or time belongs in the calendar, not
here. The only structure is **folders** (categories) — there is no due date, no
priority, no reminder.

- `TodoFolder { id, name, emoji?, order, createdAt }`
- `Todo { id, folderId?, title, note?, done, doneAt?, order, createdAt }`
  - `folderId` unset = the **"Unsorted"** bucket, a section rendered only when
    it actually holds something. Keeping it optional means a todo never has to
    wait for a folder to exist, and deleting a folder can't orphan a row into an
    invisible state.
  - `order` is per folder — a new todo takes `max(order in that folder) + 1`.
  - `doneAt` is the tick's timestamp, used to order the completed tail.

`TodosScreen` builds one `Section` per folder (in `order`), plus Unsorted last.
Inside a section, `sortTodos` keeps open tasks in their manual `order` and
**sinks ticked ones to the bottom**, newest tick first, struck through and dim —
so finishing something never makes it vanish, but it stops competing for
attention. The header shows the count of **open** todos, and a section collapses
(component state, not persisted).

Adding:
- the floating round **"+"** above the nav bar is the primary gesture — it opens
  the sheet prefilled with the first folder;
- each folder header has its own small `+` that prefills that folder;
- the screen header's **"+ folder"** creates a category.

`TodoEditor` (bottom sheet, mirroring `RoutineEditor`): task, note, a folder
picker of pills ("Unsorted" + every folder), and delete. `FolderEditor` is the
same shape for emoji + name; deleting a folder deletes its todos with it, and
the confirm names the count.

Tap the checkbox to tick, tap the text to edit, tap a folder's name to edit the
folder. Live data via `useLiveQuery`, same as the routine grid — no seed, the
lists start empty.

## Not yet done / known simplifications

- `archived` flag exists but nothing sets it (delete is hard-delete).
- Timetable: colour comes from `kind` only (no per-subject colours) and there is
  no teacher field. Not linked to the calendar or to routines.
- Recurrence stops at weekday sets, weekly counts and week parity. Nothing
  monthly, nothing every-third-week, no end date on a routine.
- Semester bounds are hard-coded constants, editable only in the source.
- Todos: no due dates (by design, for now), no reordering by drag, no archive —
  delete is hard-delete. Folders can't be reordered either.
- Calendar is a stub.
- No sync, no auth, no notifications.
- Capacitor: only `capacitor.config.ts`; `android/` not generated (needs Android
  Studio + JDK 17). Steps in README.

## Verify a change

```bash
npm run lint && npm run build
npm run dev   # then use a mobile viewport in devtools
```
Routines — grid renders 7 day rows + routine columns, today highlighted,
past-unmarked cells red, off-days grey `–`, tap cycles colours and **survives
reload**, week nav keeps per-week marks and is clamped to the year, editor
add/edit/delete works, excused cells leave the `%` alone.

Todos — "+ folder" then "+" adds a task into it, ticking sinks it to the bottom
struck through, edits and deletes **survive reload**, deleting a folder takes
its todos, and a todo with no folder shows under "Unsorted".

Timetable — all of 08:00–20:00 fits without scrolling, blocks are coloured by
kind with no hour line crossing a two-hour lesson, the "now" line sits at the
right minute on a weekday with everything left of it dimmed, week paging stops
at both ends of the semester, and an exception renders as a struck-through ghost
that can still be tapped to restore.

Changing `tailwind.config.js` (or `postcss.config.js` / `vite.config.ts`)
**needs the dev server restarted** — PostCSS caches the config at startup, so new
colour tokens silently produce no classes until then.
