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
5. **Cloud sync** across devices. Done (v1); see below.
6. Later: reminders/notifications, stats.

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
  db/db.ts                     # Dexie schema v5 (routines, entries, lessons,
                               # todoFolders, todos, tombstones, meta);
                               # updatedAt stamping hooks + onLocalWrite
  db/remove.ts                 # deletes that leave a tombstone behind
  db/seed.ts                   # default routines + the timetable, each inserted
                               # once when its table is empty; plus backfills
  features/
    routines/                  # THE feature — see below
    timetable/                 # school timetable — see below
                               # layout.ts (geometry) semester.ts occurrence.ts
    todos/  calendar/  settings/
  sync/                        # supabase.ts (client + config flag)
                               # engine.ts (push/pull/merge) useSync.ts (hook)
  ui/                          # ScreenHeader, EmptyState, ...
supabase/schema.sql            # the one table sync needs; run once in Supabase
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
  there and is dropped — the cycle rotates over the _visible_ state,
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
odd / even), and delete (also wipes that routine's entries). New routine via
the "+ routine" header button. The emoji field still takes direct typing/paste,
but focusing it also opens `EmojiPickerPanel` (`ui/EmojiPicker.tsx`, shared with
`FolderEditor`) inline below the row — search by English name against
`ui/emojiData.ts`'s ~1900-entry `[emoji, name]` list, dynamically imported so
browsing emoji only costs a fetch the first time someone opens the panel. That
data file is generated, not hand-written — its header says how to regenerate
it from a newer Unicode release; the `unicode-emoji-json` package that made it
was never added as a dependency. Drag a column header sideways to reorder: the grabbed icon follows the
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
row height are fixed pixels. Rows are positioned in pixels (`top: i * ROW_HEIGHT`)
against the grid container's own `height: GRID_HEIGHT`, so that container needs
`boxSizing: 'content-box'` set explicitly — Tailwind's global `border-box` would
let its 1px border eat into that height, clipping the last row (Friday) against
`overflow-hidden`. The trade-off is narrow blocks: on a 360px phone an
hour is ~25px and a two-hour lesson ~50px, so long codes truncate. Going back to
a fixed pixels-per-minute scale with sideways scrolling is a one-constant
change.

Labels are centred on what they label: an hour number sits over its own column
(`HOUR_PCT` wide, so the 19 doesn't overflow the right edge) and a day label is
centred in the `GUTTER`. Today's row is tinted `bg-today` with its label in
brass, matching the routine grid — but only in the current week (`showNow`).
`bg-today` is a fully opaque fill, and unlike the routine grid's `<td>`s
(where a background can never cover a cell's own border), the timetable's hour
ticks are separate absolutely-positioned siblings — so the tint is painted as
its own rectangle _before_ them in the grid, not as a class on the day row
itself, or it would blot every tick out across the whole row.

- `Lesson { id, name, kind, group?, room?, day, start, end, skipDates?, onlyDates?, recorded?, absenceLimit?, absentDates?, coveredDates?, createdAt }`
  - `day` is 0=Mon..4=Fri, `start`/`end` are "HH:MM" inside the window.
- `recorded` marks a lesson that is filmed, so it doesn't have to be attended in
  person — it matters because of the commute. The block gets a small **camera**
  in its top-right corner (`ui/CameraIcon.tsx`, dimmed on a ghost) and the
  editor has a "Recorded — no need to go" toggle. Nothing else changes: the
  lesson still occupies its slot.
- `absenceLimit` is how many **excused absences a semester** the subject allows
  (seminars and labs usually allow a few); `absentDates` are the dates actually
  missed. `features/timetable/absence.ts` turns the two into `{ limit, used,
left }`, counting only dates **inside the current semester** — so moving
  `SEMESTER_START` / `SEMESTER_END` resets the allowance by itself, with no
  clearing of last term's dates.
  - An absence is not a cancellation: the lesson still happened, so this is a
    separate list from `skipDates` and doesn't touch `happensOn`.
  - The block shows **one dot per allowed absence** along its bottom edge, the
    spent ones filled red (`AbsenceDots`). Dots rather than a "1/3" label
    because an hour column is ~27px on a phone and the room already owns the
    text — and they read peripherally, without counting. A full red row means
    none are left, i.e. that one has to be attended. Above six the dots would
    not fit and it falls back to "2 left".
  - The editor sets the limit with a stepper (0 = not tracked) and records the
    absence for the tapped date with "I wasn't there", next to the existing
    cancel-this-one gesture — it writes immediately and closes, like that one.
    `toggledAbsence` settles `coveredDates` in the same write, both ways: being
    there covers that date, missing it un-covers it. Clearing an absence
    without covering the date would leave it neither absent nor covered, which
    is precisely what `pendingSeminarAbsences` reads as an unsettled past
    seminar — so Today would record the absence again the moment it mounted and
    the dot would turn red once more.
- `weeks` restricts a lesson to odd or even **semester** weeks (the parity
  `SemesterNav` shows), set from the editor's "Repeats" row. A mismatched week
  renders the lesson as a ghost, like any other exception.
- `kind` is `lecture` | `seminar` | `lab` — shown as the user's L / S / D
  (lecture / seminar / demo class; the `lab` id is historical, kept so no stored
  lesson needs migrating) — and picks the
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
  today's row. `nowMarker` / `elapsedPct` in `layout.ts` do the maths;
  `lib/useNow.ts` re-renders every 30 s.
  - Only **lesson blocks** grey out with the past (`bg-ink/60` scoped to each
    block's own rectangle, `pointer-events-none`), never the grid itself — the
    hour lines and row borders stay put underneath so the table never looks
    like it lost its structure. A block wholly behind "now" greys out
    entirely; one straddling it greys just its passed left edge, computed by
    comparing the block's own `left`/`width` against `elapsedPct`'s cut point,
    both in the same 0..100 day-percentage domain.
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
  - A week other than the current one is reference rather than the day's plan,
    so `TimetableScreen` washes the whole grid out (`opacity-70 saturate-[.45]`
    on a wrapper, keyed off `week.isCurrent`). A wrapper rather than anything
    inside the grid: nothing then has to thread "is this the current week"
    through every block, tick and marker. It stays fully interactive — paging
    back to cancel a lesson or record an absence is the main reason to be
    there. Outside the semester no week is current, so every one reads this
    way, which is right: none of them is today.
  - `semesterWeek` returns null outside the semester. Then the view defaults to
    week 1, the jump-to-now button is disabled and no marker is drawn.
- **Per-date exceptions** (`occurrence.ts`) break the weekly rhythm:
  `Lesson.skipDates` cancels individual dates, `Lesson.onlyDates` restricts the
  lesson to a list. `happensOn` applies three rules in a fixed order —
  `onlyDates` wins outright (naming a date is the most explicit thing there is),
  then `skipDates`, then `weeks` parity. Note that _having_ `onlyDates` makes it
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
here. Two sub-tabs (`Tab` in `TodosScreen`):

- **Today** — the flat list of what I mean to do today, pulled in from the
  folders. The tab label carries the outstanding count.
- **All** — every task, as the folder tiles below.

**Classes on Today.** Above the planned todos, the Today tab lists lesson
occurrences (`ClassList`, fed by `lessonOccurrences` in
`features/timetable/cover.ts`): today's lessons (`lessonsOn` — the right
weekday, `happensOn` with the semester parity, nothing outside the semester),
plus every earlier lecture or lab nobody ticked off yet — it **carries over**
exactly like a planned todo, showing on every later day until marked, and
dropping off for good the day after it's ticked. One tap ticks a class off,
seen any way — there's no picker, just done/not done — stored as a plain date
list in `Lesson.coveredDates` (`string[]`), so it syncs with the lesson row and
needs no new table. Ticking also takes back an absence recorded for that
date, and the timetable's "I wasn't there" is the same edit in reverse.
A **tracked seminar** (`kind === 'seminar'` with an `absenceLimit`) never
lingers this way: `pendingSeminarAbsences` finds one left uncovered once its
day has passed and a `useEffect` in `TodosScreen` settles it straight into
`Lesson.absentDates` instead — missing a seminar has a real cost (one of a
limited excuse count), not just something to catch up on later. Open classes
(including carried-over ones) count towards the tab badge. An open one carried
over from an **earlier week** shows its date in red (`isFromEarlierWeek`):
running late inside the week I'm in is ordinary, but a class still open when
the timetable has come round to it again has slipped a whole cycle. It compares
the Monday each date belongs to rather than `semesterWeek`, which is null
outside the semester and would leave the comparison undecidable there. A ticked
class never reddens — it's finished, so its age stops mattering. Within the
open/done split, classes sort by date (oldest first), then subject name, then
kind (**L**ecture → **S**eminar → **D**emo/lab) — so a run of leftovers from
one subject reads `#L1, #S1, #L2, #S2` rather than jumping between subjects.

**Two flavours of weekly school work** sit under a subject, and the difference
is the whole point:

- **`repeatWeekday`** is a *deadline* — "hand it in by Sunday". One cycle at a
  time: `dueBy` advances only once the ticked cycle's day has passed
  (`dueRolloverPatch`), so it is late rather than stacking, and a missed week
  reads "overdue since" until it's ticked.
- **`weeklySince`** is a *week's worth of work* — "go through the exercises
  this week". No deadline at all; it is owed once a week and every week from
  `weeklySince` to the current one that isn't in `completedDates` stays
  outstanding **side by side**, carried over and reddened by week exactly like
  a class (`features/todos/weekly.ts`). It renders as
  `Interaktivní Osnova #W2 (14.09)`.

That second flavour is deliberately the *class* model — one template row, N
accumulating occurrences — because it is the same kind of thing: work attached
to a week rather than to a date. Reusing it meant no third recurrence engine.

The two are mutually exclusive, and the **presence of `weeklySince` is the
discriminator** — no separate flavour flag, which could contradict the payload.
`TodoEditor` holds one `RepeatMode` state ("One-off" / "Every week" / "By a
weekday", one row of chips) and writes exactly one of the two fields, so a
contradictory row can't be produced. `completedDates` is shared: due dates for
one flavour, **Mondays** for the other — safe because they can't coexist, but
switching flavour on an existing todo clears the history, since the old entries
mean the other thing.

"Every week" is offered only once a **subject** is picked (and clearing the
subject drops back to one-off): it is a school construct, and without a subject
there is no group or folder that renders occurrence rows. That also makes the
**folder optional** for any subject-tagged todo — `allowUnsorted` includes
`subject !== null`, the chip then reads "In the subject", and `buildSections`
keeps such a todo out of the Unsorted bucket, because its home is the subject.

`weeklyOccurrences` clamps its start to the semester's first Monday. That clamp
is not optional: when `SEMESTER_START`/`SEMESTER_END` move on to the next term,
a surviving weekly todo's `weeklySince` points into the old one, and an
unclamped walk would emit every week of the gap at once. Clamped, it restarts
at week 1 with last term's `completedDates` sitting inert, keyed to Mondays no
new week ever looks up.

`done` is not dead weight on a weekly todo — ticking the *current* week mirrors
into it, so every generic aggregate that asks `!todo.done` (the folder tile's
count, `sortTodos`, the plain folder list) keeps working untouched and keeps
answering "is there anything outstanding this week". The backlog lives in
`completedDates` alone and concerns only the subject views. `weeklyRolloverPatch`
re-arms `done` when the week turns.

The undo grace works without a `coveredAt`-style timestamp map: a tick always
appends and always stamps `doneAt`, so "the last entry, stamped today" is
exactly the tap that just happened.

The only structure is **folders** (categories) — there is no priority, no
reminder, and mostly no due date (see **Dues** below, the one exception).

- `TodoFolder { id, name, emoji?, order, isDefault?, createdAt }`
  - `isDefault` marks the **catch-all** folder a new todo lands in — the seeded
    "Others". At most one folder carries it; if it is edited away the first
    folder stands in.
- `Todo { id, folderId?, title, note?, done, doneAt?, plannedFor?, plannedSince?, dueBy?, order, createdAt }`
  - `folderId` unset = the **"Unsorted"** bucket, a section rendered only when
    it actually holds something. Since "Others" exists it is a safety net rather
    than a destination: the editor only offers "Unsorted" when there are no
    folders at all, or to a todo already sitting there.
  - `order` is per folder — a new todo takes `max(order in that folder) + 1`.
  - `doneAt` is the tick's timestamp, used to order the completed tail.
  - `plannedFor` (`YYYY-MM-DD`) is the date it was pulled onto **Today**. The
    todo stays in its folder either way — this only says "I mean to do it
    today", which is why it is a plain date and not a due date.
  - `plannedSince` is the start of the current run on Today, written alongside
    it by `planPatch` and used only for the "carried over since" label.
  - `dueBy` (`YYYY-MM-DD`) is the one real deadline in Todos — see **Dues**
    below. It is deliberately a separate field from `plannedFor`: the two read
    in opposite directions (a plan waits until its day; a deadline shows right
    away and keeps showing).

The **All** tab has two views, switched by `openKey` (component state, not a
route):

- the **overview** — one square **tile** per folder, in `order`, with Unsorted
  last. They are a `repeat(auto-fill, minmax(9rem, 1fr))` grid, so they sit side
  by side and wrap onto the next line when they no longer fit: the column count
  follows the viewport (two on a phone, more on a wide screen) instead of a
  breakpoint. A tile shows its emoji, name and `N open` / `all done` / `empty`.
- the **folder view** — that folder's tasks, reached by tapping its tile, with a
  back arrow and an "Edit" button for the folder itself. `openKey` is resolved
  against the live sections, so deleting the open folder falls back to the
  overview instead of a blank screen.

`features/todos/today.ts` decides what the **Today** tab shows. `isOnToday`
takes `plannedFor <= today`, not `=== today`: an unfinished task **carries
over** rather than silently dropping back into its folder overnight, and
`isCarriedOver` labels it — "carried over since 14.09", naming `plannedSince`:
the day the task **first** landed on Today in its current run, so a task quietly
sliding from day to day shows how long it has been sliding. `planPatch` keeps
that day through every "→ tomorrow" and clears it only when the task leaves
Today; `plannedSinceOf` falls back to `plannedFor` for todos planned before the
field existed. A task ticked on an earlier day drops out — it is
finished, and today's list is about what is still ahead. `sortToday` groups the
list by folder (in folder order, so it reads in the same sequence as the
tiles) and falls back to the task's **title, alphabetically** within one —
not each task's own per-folder `order`, since two folders' order numbers can
overlap and interleaving by that would break the grouping. Each row shows
which folder it came from. A due todo (see **Dues** below) is left out of this
list — it has its own group instead, so it never shows twice.

**Dues.** A todo with `dueBy` set gets its own group on Today, `DuesList`,
between Classes and the folder-grouped list — for a real deadline ("hand this
in by Friday") rather than a plan for a particular day. `isDue` (also in
`today.ts`) shows it every day from the moment the deadline is set, through the
due day and past it as overdue, until it's ticked — the opposite direction from
`isOnToday`, which waits until `plannedFor` arrives. `isOverdue` flags a still-open
one whose `dueBy` has passed, styled like `isCarriedOver`'s label but reading
"overdue since" instead. Sorted soonest-deadline-first; ticked ones sink to the
bottom the same day, then drop off like any other Today row the day after. Set
from `TodoEditor`'s own "Due" row (a "No deadline" chip plus a date chip,
mirroring "Plan"); a due todo still lives in its folder exactly like a planned
one, and `TodoRow` shows "due 27.09" / "overdue since 20.09" wherever else it's
listed.

Inside a folder, `sortTodos` keeps open tasks in their manual `order` and
**sinks ticked ones to the bottom**, newest tick first, struck through and dim —
so finishing something never makes it vanish, but it stops competing for
attention.

Adding:

- the floating round **"+"** above the nav bar is the only add gesture and is
  present everywhere: it prefills **the open folder** (or the default one), and
  on the Today tab it also prefills today;
- the **☀︎ sun** on every row pulls a task onto Today; tapping a lit one drops it
  back to Someday — the quick gesture, next to the editor's "Plan" row. It is
  lit for `plannedFor <= today` only, so a task pushed ahead reads as unplanned
  for now and the sun pulls it back to today rather than clearing it;
- the **🗓︎ calendar** opens the platform's own date picker (a transparent
  `<input type="date">` over the button, in the row and as the editor's "On a
  date" chip) — any day, not just tomorrow; clearing the field unplans the task.
  No calendar is drawn by hand: the native one already knows the locale and the
  first weekday;
- the **→ arrow** next to it pushes the task to **tomorrow** (`nextDay`) — the
  explicit "not today after all", as opposed to simply leaving it unfinished,
  which carries it over instead. It is hidden (but keeps its slot) on a ticked
  task. A task planned for a later day waits in its folder, labelled
  "tomorrow" or with its date;
- the screen header's **"+ folder"** creates a category (All tab only).

Drag a folder tile to reorder the overview grid — same spirit as the routine
column drag (`features/todos/TodosScreen.tsx`'s `FolderTiles`): the grabbed
tile follows the pointer 1:1 while the rest slide live into their target slot,
held until the persisted `order` catches up. It is a wrapping 2D grid rather
than a single row, so the slot math tracks row _and_ column, and the column
count is measured from the live layout each drag (it follows the viewport, not
a breakpoint). The "Unsorted" tile, when present, has no `order` of its own and
always trails the real folders — it never takes part in the drag.

`TodoEditor` (bottom sheet, mirroring `RoutineEditor`): task, note, a folder
picker of pills ("Unsorted" + every folder), and delete. `FolderEditor` is the
same shape for emoji + name, emoji field and search-by-name picker included
(see `EmojiPickerPanel` under Routine tracker above); deleting a folder
deletes its todos with it, and the confirm names the count.

Tap the checkbox to tick, tap the text to edit, tap "Edit" in an open folder to
rename or delete it. Live data via `useLiveQuery`, same as the routine grid.

`SEED_FOLDERS` in `db/seed.ts` creates the user's categories once, when the
`todoFolders` table is empty (same guards as the other seeds): **DiD** (the game
he's building), **DnD** (the campaign he DMs), **School**, **Job** and
**Others** — the default. The todos themselves start empty.

## Sync — how it works

Cross-device sync over **Supabase**, added because the app's data lived only in
each browser's IndexedDB: a change made on the work PC was simply invisible on
the personal one. Optional — with no `.env` the app is exactly what it was,
local-only, and the Settings block says so instead of offering a sign-in that
could not work.

Setup is `.env.example` → `supabase/schema.sql` → `.env`, and **needs the dev
server restarted** (Vite reads `.env` at startup).

**The server side is one generic table**, `records`:

```
user_id | kind | id | data jsonb | deleted | updated_at bigint | synced_at timestamptz
```

`kind` is the Dexie store name, `id` the record's own local id, `data` the whole
record. One table rather than five mirroring the stores, so adding a field to a
`Lesson` or a `Todo` needs **no migration on the server** — the app owns the
shape, the table owns the transport. RLS (`auth.uid() = user_id`) is the only
thing separating accounts, which is why the **publishable** key (`sb_publishable_…`,
the anon key before Supabase renamed it) is safe in the client — a `VITE_`
variable is baked into the bundle, so it ships to every visitor. The secret key
bypasses RLS and must never be used here.

Two timestamps, and the split matters:

- `updated_at` is the **client's** stamp and does conflict resolution —
  last-write-wins.
- `synced_at` is **server** time and is the **pull cursor**. It has to be the
  server's: with a client stamp, a device whose clock ran slow would push rows
  landing _behind_ another device's cursor, which would then never see them.

**Locally** (`db/db.ts`, schema v5): every synced row carries an `updatedAt`,
stamped by Dexie `creating`/`updating` hooks so no call site has to remember —
and a mutation that passes its own stamp keeps it, which is how a pulled row is
written without looking locally modified. Deletes are hard, so a vanished row
is indistinguishable from one never seen; `db/remove.ts` writes a **tombstone**
alongside each delete, and every delete goes through it. Local tombstones are
dropped once pushed — the server row (`deleted = true`) is the durable one.

`sync/engine.ts` pushes then pulls. A remote row is applied only when its
`updated_at` is **strictly** greater than the local one; strictly is what stops
two devices bouncing a row back and forth, since an echo compares equal and is
dropped on arrival. After applying, the push cursor moves past what was applied
so it isn't sent straight back — clamped to this device's own clock, so a device
running ahead can't push the cursor into the future and swallow edits made
meanwhile.

**The first sync on a device picks a direction** (`needsLinking` / `linkDevice`).
Every install seeds its own default routines, timetable and folders under
locally generated ids, so a second device that merely merged would end up with
two of everything. `upload` keeps this device's data, `download` discards it for
the cloud's; afterwards it is an ordinary two-way merge. Signing out, importing
a backup or resetting all clear the cursors, so the next sign-in decides again
rather than pushing a restored copy over the cloud's.

`autoLinkDirection` settles that by itself wherever it isn't a real choice — an
empty account has nothing to lose (`upload`), and a device holding nothing but
its seeds has nothing worth keeping (`download`, which is every device added
later, phone included). "Pristine" is answerable because `updatedAt` equals
`createdAt` exactly until something writes to a row, so an untouched seed is
distinguishable from an edited one; no marks, no todos and no tombstones are
the rest of the test. Only a device used offline against an account that was
also used elsewhere still gets the **"Choose a starting point"** panel, since
either answer there throws work away. A failed remote count throws rather than
reading as "the cloud is empty", which would upload over it.

Auth is an emailed **magic link** (`signInWithOtp`) — no passwords to keep — or
the **6-digit code** from the same email (`verifyOtp`), offered right under the
"check your inbox" line. The link opens in the system browser, which on a phone
is *not* the installed PWA: following it signs in a different origin's copy of
the app and leaves the one actually in use signed out. A typed code signs in the
window it was typed into, so it works where the link can't. Supabase's Magic
Link email template has to include `{{ .Token }}` for the code to be in the
mail at all — it ships with the link only — and **that template can't be edited
until custom SMTP is configured**: the built-in mailer is a development one
(two mails an hour) with its templates locked. So the field is live but the
mail is codeless until an SMTP provider is set up, which is also what the phone
is waiting on.

The session itself persists (`persistSession` + `autoRefreshToken`), so signing
in is once per device, not once per session.

**`useSync` runs above every screen**, from `SyncProvider` in `App.tsx`; the
Settings block only *reads* it, through `useSyncState` (`sync/syncContext.ts`).
That placement is the whole point: every automatic trigger belongs to the
component that called the hook, so while `SyncSection` owned it the app synced
only while Settings was on screen — a morning of ticking routines synced
nothing, and "Sync now" stopped being a convenience and became the only thing
that worked.

It syncs on local write (debounced 2.5 s via `onLocalWrite`), on any
`visibilitychange`, on `pagehide`, on `online`, on a **realtime** nudge, and on
a 60 s poll, plus a manual "Sync now". Hiding or leaving **flushes** the pending
debounce rather than waiting it out — a tick made two seconds before the tab
goes away would otherwise sit there, and a backgrounded phone tab may never be
woken again. The flush may be cut short mid-request, which costs nothing: the
row is simply still dirty and goes out on the next open.

Because sync is meant to be invisible, the one thing it must not do is fail
invisibly. `needsAttention` is true when it has stopped carrying data and only
the user can restart it — a failed sync, a pending link choice, or a signed-out
device that **was** linked before (`linkedAccount()` survives everything but an
explicit sign-out, so a lost session is distinguishable from a deliberate local
one). `BottomNav` then shows a small red dot on the Settings tab.

The realtime channel subscribes to `records` filtered by `user_id`, so the
server says when another device wrote and a change lands in about a second
instead of waiting out the poll. It is only a nudge — the pull still goes
through the `synced_at` cursor, so a missed or duplicated event costs nothing
and the payload never has to be trusted. Rows this device pushed echo back as
events too; that costs one round trip which applies nothing, because an echo
never compares newer than what is already here. `postgres_changes` honours RLS,
and `schema.sql` adds the table to the `supabase_realtime` publication (plus
`replica identity full`, or a delete would arrive without its key). The poll
stays as the backstop for a trigger dropped because a sync was already running,
and for any stretch where the socket is down.

The push cursor is stamped **before** the dirty rows are read, not after the
upsert returns (`Date.now() - 1`): a write made during the round trip would
otherwise land below a cursor stamped afterwards and never be offered again.
Re-sending a row costs an idempotent upsert; losing one costs the edit.

**Deployment.** Sync carries data between browsers, not between addresses —
`localhost:5173` on two machines is two origins, hence two databases and two
sign-ins, and a phone can reach neither. **Cloudflare Pages** hosts the one
URL every device installs as a PWA (`public/_redirects` is the whole config);
its free tier is the one that allows a site that earns something, which Vercel's
Hobby plan does not. The `VITE_` keys are build-time, so changing one needs a
redeploy, and Supabase's **Redirect URLs** have to list the deployed origin or
the magic link won't come back. README has the steps.

It is **live at https://efecto-8yx.pages.dev**, deployed from `main` on every
push, and that deployment is the **copy of record** as of 2026-09-21. The
localhost install is a different origin and therefore a different database with
a different sign-in — development only, and nothing done there reaches the
account. The two were not merged: the deployed install's data was kept and the
old localhost history deliberately abandoned, because a fresh install seeds the
*current* `SEED_TIMETABLE` from the source while localhost still held an older
edited one, and no routine marks or todos there were worth the awkward merge
(the Settings backup is all-or-nothing, so restoring them would have dragged
the stale timetable back with them).

**Room for premium later.** The app is to stay free with paid premium / no-ads
on top, and the account is already the right hook for that: `user_id` scopes
every row and RLS is what separates accounts. When entitlements arrive they
belong in their **own table** keyed by `user_id` (`profiles` / `entitlements`),
written only by the payment webhook with the secret key server-side, and read by
the client as a plain row — never a flag inside `records`, which the client
owns and could simply set. Gating that matters (anything costing money to run)
has to be enforced in RLS or an edge function; the client-side check is a
courtesy, not the lock. Nothing of this exists yet — the note is here so the
sync table isn't quietly turned into a place to keep it.

## Not yet done / known simplifications

- `archived` flag exists but nothing sets it (delete is hard-delete).
- The Settings backup is a v3 file (routines, entries, lessons, folders, todos).
  A v2 file predates todos, which is not the same as holding none, so importing
  one leaves the todo tables alone rather than wiping them.
- Timetable: colour comes from `kind` only (no per-subject colours) and there is
  no teacher field. `recorded` and `absenceLimit` are set by hand in the editor
  — the seed sets neither, and nothing warns when the allowance runs out beyond
  the dots turning red. Not linked to the calendar or to routines.
- Recurrence stops at weekday sets, weekly counts and week parity. Nothing
  monthly, nothing every-third-week, no end date on a routine.
- Semester bounds are hard-coded constants, editable only in the source.
- Todos: no archive — delete is hard-delete. A weekly deadline is accurate to
  the **day**, not the hour: "Sunday" means the end of Sunday and it reddens on
  Monday, which is why there is no time-of-day field.
  Tasks within a folder can't be reordered by drag (only folders can); neither
  the open folder nor the sub-tab is remembered across a tab switch. Nothing
  repeats: a task planned for today is a one-off.
- Calendar is a stub.
- Sync resolves conflicts per record, last-write-wins — two devices editing the
  same routine in the same minute keep whichever wrote last, with no merge and
  no warning. Timestamps are client clocks, so a badly wrong clock skews that.
- Sync has no offline queue beyond "retry on the next trigger", and no UI for a
  record that failed to push. No notifications.
- Realtime is a nudge, not a transport: a device that is closed still catches up
  only when it next opens. Nothing tells you a *different* device changed the
  thing you are looking at right now.
- Auth still runs on Supabase's built-in mailer: two mails an hour, and the
  email templates are locked, so `{{ .Token }}` can't be added and the sign-in
  code field stays empty-handed. Custom SMTP (Resend's free tier is enough)
  unlocks both, and is needed before the phone or anyone else's account.
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
add/edit/delete works, excused cells leave the `%` alone, and focusing the
emoji field opens the search panel — typing "book" finds 📚, tapping it fills
the field and closes the panel.

Todos — on a semester weekday Today starts with that day's classes, ticking
one asks how it was covered and shows the answer, and it survives reload; Today
lists exactly the planned tasks with their folder, the sun button
adds and removes them, → moves one to tomorrow, 🗓︎ opens the date picker and a
picked day shows on the task (it leaves Today and shows
"tomorrow" in its folder) and yesterday's unfinished ones stay as "carried
over"; on All the
folder tiles wrap instead of overflowing sideways at 360px, tapping one opens
its tasks and the back arrow returns, "+" adds into the open folder,
ticking sinks a task to the bottom struck through, edits and deletes **survive
reload**, deleting a folder takes its todos and drops back to the tiles, and
dragging a tile reorders the grid live and **survives reload**.

Timetable — a recorded lesson carries a camera in its top-right corner, an
`absenceLimit` one a row of dots that fill red as absences are recorded, and
all of 08:00–20:00 fits without scrolling, blocks are coloured by
kind with no hour line crossing a two-hour lesson, the "now" line sits at the
right minute on a weekday with lesson blocks behind it greyed (a straddled one
only on its passed edge) while the grid lines and row borders stay visible
throughout, week paging stops at both ends of the semester, and an exception
renders as a struck-through ghost that can still be tapped to restore.

Sync — needs a `.env` and `supabase/schema.sql` run once. Sign in on device A,
pick "Use this device's data"; sign in on device B, pick "Replace with the cloud
copy". Then a mark, a todo and an `absenceLimit` set on A show up on B within
seconds, a delete on A removes it on B rather than coming back, and both survive
a reload. Crucially, do that **without opening Settings on either device** —
that is the whole fix: mark a routine on A while sitting on the Routines tab and
it must appear on B's Routines tab within seconds. Reload A and it is still
signed in. Sign out on A and the Settings tab shows no dot (that was a choice);
break sync instead — go offline and edit something — and the dot appears. With
no `.env` the Settings block reads "Not configured" and nothing else changes.

Changing `tailwind.config.js` (or `postcss.config.js` / `vite.config.ts`)
**needs the dev server restarted** — PostCSS caches the config at startup, so new
colour tokens silently produce no classes until then.
