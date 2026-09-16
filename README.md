# Efecto

Minimalist, mobile-first efficiency app: a **routine tracker** and a **school
timetable**, with **todos** and a **calendar** to come — one place to run your
day. Offline-first, data lives on the device. Target: installable PWA now,
Google Play app later (via Capacitor).

## Status

| Feature | State |
| --- | --- |
| Routine tracker (weekly grid) | done (v1) |
| Timetable (weekly, Mon–Fri) | done (v1) |
| Todos | done (v1) |
| Calendar | stub |
| Cloud sync (Supabase) | done (v1) — needs a `.env`, see below |
| Android build (Capacitor) | config only |

## Cloud sync (optional)

Data otherwise lives only in the browser it was entered in, so the same install
on two machines holds two separate copies. Sync is opt-in and off until
configured — without it nothing changes.

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste `supabase/schema.sql`, run it.
3. Copy **Project Settings → API →** the Project URL and the anon key into a
   `.env` file (see `.env.example`).
4. Restart `npm run dev` — Vite reads `.env` at startup.

Then **Settings → Sync**: enter an email, open the magic link it sends, and pick
a starting point. Do this on the first device with **"Use this device's data"**
and on every other device with **"Replace with the cloud copy"** — each install
seeds its own defaults, so merging both would give you two of everything. After
that it syncs on its own: on save, on focus, and on a slow poll.

The anon key belongs in the client; row level security is what keeps one
account's rows away from another's.

## Routine tracker

A week is a grid: **7 rows = days (Mon–Sun)**, **columns = routines**
(horizontally scrollable, sticky day column + header). Each week shows its **ISO
week number and whether it's odd or even**. Tap a cell to cycle its state:

| Taps | State | Colour | Counts as |
| --- | --- | --- | --- |
| 1 | done | green | pass |
| 2 | missed | red | fail |
| 3 | excused | blue | neither — excluded from the % |
| 4 | back to pending | — | not yet counted |

- A day with **nothing outstanding is 100 %** — no routines scheduled, or every
  one of them excused.
- **Blue = excused.** A routine you had a good reason to skip (ill, travelling)
  is neither a pass nor a fail: it leaves the day's ratio completely, exactly
  like a weekday the routine doesn't apply to.
- A past day left untouched shows **red** automatically (derived at render, no
  background job). On past days the cycle skips the empty step — it looks the
  same as red — and rotates red → blue → green.
- A routine that doesn't apply to a weekday shows a grey `–` and isn't tappable
  (set per-routine in the editor — e.g. a gym split on Mon/Tue/Thu/Fri).
- Tap a column header to edit the routine — emoji, name, its schedule, or delete
  it (which also removes its marks). Drag a header sideways to reorder.
- **Schedules.** A routine either applies on **set weekdays** (a gym split on
  Mon/Tue/Thu/Fri) or is a **weekly target** — "3× a week", any day. A target
  owes no particular day, so no day of it ever turns red on its own and it
  doesn't affect a single day's percentage; it counts once for the week, and the
  column header shows how you're doing (`2/3`). Extra sessions don't count above
  the target.
- Either kind can be limited to **odd or even weeks**. A routine that doesn't
  apply this week shows grey `–` all week and its header dims.

## Timetable

A weekly school timetable: **Mon–Fri, 08:00–20:00**, laid out like the routine
grid — **rows are days, time runs left to right**. The whole window fits the
screen, so there is nothing to scroll. It's a template: it repeats every week
and isn't tied to dates.

Each lesson is a **lecture (L, green)**, a **seminar (C, yellow)** or a **lab
(LAB, blue)**, and carries a subject code, an optional seminar group and a room —
`PV170/09` in `S405`.

- Tap any empty slot to add a lesson; it's prefilled with the hour you tapped.
- Tap a lesson to edit its code, type, group, room, day and times, or delete it.
- A lesson can repeat **every week, or in odd or even semester weeks only** —
  set it under *Repeats*. In a week it doesn't run it shows as a ghost.
- Lessons that overlap in time are stacked within the day's row, so a clash
  stays visible.
- A default timetable is seeded on first run and is fully editable.
- **One-off exceptions:** tap a lesson and use *Cancel this one* to drop just
  that week's occurrence, or *Restore this one* to put it back. A lesson that
  isn't happening that week is still shown, greyed out and struck through, so
  you can see what would have been there — and tap it to bring it back.
- Page through the semester's weeks with the arrows; the header shows the
  **semester week, whether it's odd or even, and its dates**. Paging is clamped
  to the semester and the lessons themselves don't change — the timetable is a
  template — so it's the week label, the parity and the "now" marker that move.
- The semester's dates are set in `src/features/timetable/semester.ts`
  (currently 14 Sep 2026 – 18 Dec 2026) and need updating each semester.
- On a weekday, a vertical line marks the current time and everything to its
  left — the part of the week that has already happened — is dimmed. At the
  weekend neither is shown; the timetable reads as the week ahead.

## Development

Requires **Node.js 20 LTS**.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # -> dist/  (also generates the PWA service worker + manifest)
npm run preview
npm run lint
```

Path alias `@/` → `src/`.

## Tech stack

- **Vite 6** + **React 18** + **TypeScript**
- **Tailwind CSS 3** — design tokens in `tailwind.config.js`
- **Dexie 4** (IndexedDB) + `dexie-react-hooks` for local-first storage
- **vite-plugin-pwa** — offline shell, auto-updating service worker
- **Capacitor 6** — native Android wrapper for the Play Store

## Data

Everything is stored locally in IndexedDB (`efecto` database):

- `routines` — `{ id, name, order, activeDays[0..6], time?, timesPerWeek?, weeks?, archived, createdAt }`
- `entries` — one per marked cell, id `"{routineId}|{YYYY-MM-DD}"`, `status`
- `lessons` — timetable entries, `{ id, name, kind, group?, room?, day, start, end }`
  plus `weeks?` and the per-date exceptions `skipDates?` / `onlyDates?`; `day` is
  0=Mon..4=Fri
- `meta` — key/value (seed marker, schema version)

Default routines and a default timetable are seeded once on first run — each
when its own table is empty — and are fully editable afterwards.
**Settings → Export / Import** does JSON backup & restore; **Reset** wipes and
re-seeds.

## Android / Google Play

Config lives in `capacitor.config.ts` (`appId: com.bacilek.efecto`). The native
project isn't generated yet. When ready, on a machine with **Android Studio +
JDK 17**:

```bash
npm i -D @capacitor/cli @capacitor/core @capacitor/android
npx cap add android          # creates ./android
npm run build && npx cap sync
npx cap open android         # build a signed AAB in Android Studio -> Play Console
```

The `android/` folder is currently git-ignored; commit it once it exists if you
want reproducible/CI builds.

## License

Private project.
