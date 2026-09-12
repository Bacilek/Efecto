# Efecto

Minimalist, mobile-first efficiency app. **Routine tracker** first, then built-in
**todos** and a **calendar** — one place to run your day. Offline-first, data
lives on the device. Target: installable PWA now, Google Play app later (via
Capacitor).

## Status

| Feature | State |
| --- | --- |
| Routine tracker (weekly grid) | done (v1) |
| Todos | stub |
| Calendar | stub |
| Timetable (weekly, Mon–Fri) | done (v1) |
| Cloud sync | later |
| Android build (Capacitor) | config only |

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
- Tap a column header to edit the routine (name, time, active weekdays, delete).
  `time` is optional and only orders the columns.

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
- Lessons that overlap are shown side by side, so a clash is visible.
- A default timetable is seeded on first run and is fully editable.
- The header shows the **semester week and its parity**. The semester's first
  Monday is set in `src/features/timetable/semester.ts` and needs updating each
  semester.
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

- `routines` — `{ id, name, order, activeDays[0..6], time?, archived, createdAt }`
- `entries` — one per marked cell, id `"{routineId}|{YYYY-MM-DD}"`, `status`
- `lessons` — timetable entries, `{ id, name, kind, group?, room?, day (0=Mon..4=Fri), start, end }`
- `meta` — key/value (seed marker, schema version)

Default routines are seeded once on first run and are fully editable.
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
