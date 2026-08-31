# CLAUDE.md — Efecto

Context for AI assistants working on this repo. Read this first; it saves the
user re-explaining the project every session.

## What Efecto is

A **minimalist, mobile-first efficiency app**. The long-term goal is one app that
replaces a pile of productivity tools:

1. **Routine / habit tracker** — the core, built first. Weekly grid.
2. **Todos** — built-in task lists (next).
3. **Calendar** — events + a day view (after todos).
4. Later: cloud sync across devices, reminders/notifications, stats.

Design language: minimal, calm, dark, a bit "paper + brass". No clutter, few
colours, large tap targets. Think a quiet dashboard, not a busy app.

Distribution: **installable PWA now**, **Google Play app later** via Capacitor
(iOS possible but not a priority).

## Conventions

- **UI text: Czech.** **Code, identifiers, comments, docs, commit messages:
  English.**
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
  app/BottomNav.tsx            # Rutiny | Úkoly | Kalendář | Nastavení
  lib/date.ts                  # week math; weekday index 0=Mon..6=Sun (NOT JS getDay)
  lib/cn.ts
  db/db.ts                     # Dexie schema (routines, entries, meta)
  db/seed.ts                   # default routines, inserted once when empty
  features/
    routines/                  # THE feature — see below
    todos/  calendar/  settings/
  ui/                          # ScreenHeader, EmptyState, ...
```

## Routine tracker — how it works

Layout: **rows = 7 days (Mon–Sun) of the selected week, columns = routines.**
Horizontally scrollable; day column and header row are sticky. Today's row is
highlighted. `WeekNav` moves between weeks.

Data (`db/db.ts`):
- `Routine { id, name, emoji?, order, activeDays: WeekdayIndex[], time?, archived, createdAt }`
  - `emoji` optional single emoji, shown as the column header (falls back to `name`).
  - `activeDays` = which weekdays it applies to (0=Mon..6=Sun).
  - `order` primary column sort, set by dragging the header cells.
  - `time` optional "H:MM", only a tie-breaker after `order` (`compareRoutines`);
    editable only for an existing routine, not in the create form.
- `Entry { id: "${routineId}|${dateISO}", routineId, date, status, updatedAt }`
  - Only explicit marks are stored. No entry = pending (or off / derived-missed).

Cell state (`features/routines/status.ts` → `resolveCellState`):
1. weekday not in `activeDays` → **off** (grey `–`, not tappable)
2. entry exists → its status: **done** / **busy** / **missed**
3. no entry, date < today → **missed** (derived — this is the "auto red at end of
   day" behaviour, done at render time, no cron/service worker)
4. no entry, today or later → **pending**

Tap cycles the **stored** status: `undefined → done → missed → busy → undefined`
(`nextStatus`). 1 tap = done (green), 2 = missed (red), 3 = busy / "couldn't be
done" (blue).

`RoutineEditor` (bottom sheet): emoji, name, time (edit only), 7 weekday toggles,
delete (also wipes that routine's entries). New routine via the "+ rutina" header
button. Drag a column header sideways to reorder (`onReorder` → rewrites `order`).

Completion stats (`features/routines/stats.ts`): `pct = done / applied` where
"applied" = every non-`off` cell. `busy` / `missed` / past-unmarked count against
it. Each day row shows its `%` under the date; a bar under `WeekNav` shows the
week total (`weekCompletion` = sum over the 7 days).

Live data via `dexie-react-hooks` `useLiveQuery` — mutations just write to Dexie
and the grid re-renders.

## Not yet done / known simplifications

- `archived` flag exists but nothing sets it (delete is hard-delete).
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
