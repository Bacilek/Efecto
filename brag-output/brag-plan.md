# Brag Plan: Efecto

## What is this app?
A calm, dark, mobile-first PWA that replaces a pile of productivity apps with one: a weekly
routine grid, folder-based todos with a "Today" plan, a school timetable, and cloud sync.

## The angle
One quiet app instead of five loud ones. The product is deliberately minimal ("paper + brass"),
so the video is too: no hype, no SaaS lines, just the actual screens doing their one gesture each
— a tap that turns a cell green, a sun that pulls a task onto Today, a brass line sliding across
the week. Confidence through restraint.

## Hook (first 2-3 seconds)
Four app labels — "Habit tracker", "To-do list", "Timetable", "Calendar" — drift in scattered
like a cluttered home screen, then collapse into the single brass-framed "E" icon.
Line: "Too many apps for one day."

## Key moments (the middle)
- The routine grid: Mon–Sun rows × emoji columns (💊 🏋️ 💼 📚 😴). Taps cycle a cell
  ✓ done → ✕ missed → ~ excused; the day's % ticks up and the week bar fills.
- Todos "Today": the ☀︎ sun pulls "Map the DnD dungeon" onto Today; an old task carries the
  label "carried over since 14.09"; → pushes one to tomorrow.
- Timetable: Mon–Fri rows, green/yellow/blue blocks (PV028/CZ, MB142/09, PA015), the brass
  "now" line sliding across Wednesday while passed blocks grey out.

## Outro / punchline
The E icon + "Efecto" wordmark. Sub-line: "Routines · Todos · Timetable · Sync". Final quiet
line: "One app. Less noise."

## User flow worth showing
Open the week → tap today's cells (done / missed / excused) → watch the % move.
Pull a task onto Today with the sun → push another to tomorrow.
Glance at the timetable → the now-line shows where you are.

## Tone
- Preset: polished
- Creative direction: quiet paper-and-brass product film
- Interpretation: fewer, longer holds; soft slides and crossfades; muted palette with one brass
  accent; no exclamation marks.

## Format: landscape — 1920x1080
## Duration: 21.5s

## Visual identity (from the project)
- Background: #12141c (ink); panels #1a1d28 / #20232f; lines #2c3040; today row #262a3a
- Accent: #c08a3e (brass)
- Text: #ede9de (parchment), muted #8b8e9e
- States: done #7a9b76, missed #b5645f, busy #5b7fa6; seminar #b5a44f
- Display font: Fraunces 500
- Body font: Inter; numbers/labels JetBrains Mono
- Strongest visual element: the routine grid with coloured bordered cells

## Share copy (draft)
I got tired of five productivity apps, so I built one quiet one: Efecto — routines, todos and my
school timetable in a single dark little PWA.

## Audio direction
- Role: sparse professional accents over a warm bed
- Music: happy-beats-business-moves-vol-12 (steady, clean), ~0.3 volume, fade in 0.5s, fade out
  over the last ~1.5s
- Music cue guidance: preset `assets/music/cues/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json`
  (≈110 BPM). Strong cues: 8.74s (a grid tap), 13.11s (sun tap), 18.56s (outro wordmark).
  Beat grid for grid taps: every other beat (≈1.1s apart) — 7.64 / 8.74 / 9.83.
- Audio-reactive treatment: subtle; bass/RMS makes the brass glow behind the phone and the icon
  breathe. No visualizer graphics.
- SFX posture: sparse; soft clicks on taps, one soft drop on the reveal, one bell on the outro.
- Audio-coupled moments: cell taps, sun tap, outro logo.
- Restraint rule: never more than one SFX per beat; nothing harsh.

## Storyboard

### Scene 1 — Clutter → one — 3.0s
Four label chips scattered, line "Too many apps for one day." holds ~1.6s, chips then collapse to
centre into the E icon.
Sequential/interaction: chips arrive one by one (fast), then collapse together.
Audio intent: soft, curious start. Audio-coupled idea: soft drop on the collapse.
Transition mood: soft → Scene 2

### Scene 2 — Reveal — 3.0s
E icon moves left, "Efecto" in Fraunces rises beside it, sub-line "A quiet dashboard for your
week." holds ~1.5s.
Sequential/interaction: none. Audio: gentle impact on wordmark.
Transition mood: slide → Scene 3

### Scene 3 — Routine grid — 5.5s
Phone mockup (real app chrome: WeekNav "15 – 21 Sep · Week 38 · even", bottom nav) with the grid.
Left-side copy: "Tap once. Done." then list "✓ done · ✕ missed · ~ excused" held.
Sequential/interaction: yes — simulated taps on Thursday's row: ✓, ✓, ✕, ~; the day % ticks
63 → 75 → 83 %, week bar fills. Taps on every other beat.
Audio-coupled idea: click per tap. Transition mood: slide → Scene 4

### Scene 4 — Today — 4.0s
Phone shows Todos "Today" tab: rows with folder tags (DiD, School, DnD). The sun on
"Map the DnD dungeon" lights and the row slides into Today; a row shows "carried over since
14.09". Left copy: "Plan today. Carry the rest."
Sequential/interaction: yes — sun tap, → tap. Audio: click on each tap.
Transition mood: slide → Scene 5

### Scene 5 — Timetable — 3.5s
Wide timetable card (no phone): Mon–Fri rows, 08–20 hour ticks, coloured blocks, brass now-line
sweeping Wednesday, passed blocks greying. Copy: "Your whole week. No scrolling."
Sequential/interaction: now-line sweep. Audio: none beyond the bed.
Transition mood: soft → Scene 6

### Scene 6 — Outro — 2.5s
E icon + "Efecto" centred (lands on 18.56s cue), "Routines · Todos · Timetable · Sync" under it,
then "One app. Less noise."
Audio: bell accent, music fades.

**Music mood for this video:** calm, steady, polished
**Audio summary:** a warm steady bed that the taps click along with, closing on one bell as the
wordmark lands and the music fades.
