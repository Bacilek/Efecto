import { db, newId, type Lesson, type Routine, type TodoFolder } from './db'
import type { WeekdayIndex } from '@/lib/date'

const ALL: WeekdayIndex[] = [0, 1, 2, 3, 4, 5, 6]
const WEEKDAYS: WeekdayIndex[] = [0, 1, 2, 3, 4]
const WEEKEND: WeekdayIndex[] = [5, 6]
const GYM: WeekdayIndex[] = [0, 1, 3, 4] // Mon, Tue, Thu, Fri

type SeedRoutine = Pick<Routine, 'name' | 'activeDays'> & { time?: string; emoji?: string }

/**
 * Default routines carried over from the original prototype. They are inserted
 * only once (when the routines table is empty) and are fully editable afterwards.
 */
const SEED: SeedRoutine[] = [
  { name: 'Letrox on empty stomach', emoji: '💊', time: '6:00', activeDays: ALL },
  { name: 'Gym', emoji: '🏋️', time: '7:40', activeDays: GYM },
  { name: 'Work / SOC', emoji: '💼', time: '9:40', activeDays: WEEKDAYS },
  { name: 'Godot / Claude Code', emoji: '🖥️', time: '19:00', activeDays: ALL },
  { name: 'Wizard Wars', emoji: '🎮', time: '20:00', activeDays: ALL },
  { name: 'Study / assignments', emoji: '📚', time: '20:00', activeDays: WEEKDAYS },
  { name: 'Trading review', emoji: '📈', time: '21:00', activeDays: ALL },
  { name: 'Calorie goal', emoji: '🍽️', activeDays: ALL },
  { name: 'Protein goal', emoji: '🥩', activeDays: ALL },
  { name: 'Creatine', emoji: '💪', activeDays: ALL },
  { name: 'D&D session', emoji: '🎲', activeDays: WEEKEND },
  { name: 'Go to sleep', emoji: '😴', time: '23:00', activeDays: ALL },
]

/**
 * Emoji for routines created before emojis existed. Those rows carry the
 * original Czech seed names, so this map is deliberately kept separate from
 * `SEED` — translating the seed must not break the backfill.
 */
const LEGACY_EMOJI: Record<string, string> = {
  'Letrox nalačno': '💊',
  Gym: '🏋️',
  'Práce / SOC': '💼',
  'Godot / Claude Code': '🖥️',
  'Wizard Wars': '🎮',
  'Studium / úkoly': '📚',
  'Trading review': '📈',
  'Kalorie goal': '🍽️',
  'Protein goal': '🥩',
  Kreatin: '💪',
  'D&D session': '🎲',
  'Jít spát': '😴',
}

/**
 * Backfill `emoji` on routines created before emojis existed. Matches the
 * legacy seed names; runs once (guarded by a `meta` flag). Safe to keep around
 * — it never overwrites an emoji the user already set.
 */
export async function backfillEmojis(): Promise<void> {
  const done = await db.meta.get('emojiBackfill')
  if (done) return

  await db.transaction('rw', db.routines, db.meta, async () => {
    const all = await db.routines.toArray()
    for (const r of all) {
      if (r.emoji) continue
      const emoji = LEGACY_EMOJI[r.name]
      if (emoji) await db.routines.update(r.id, { emoji })
    }
    await db.meta.put({ key: 'emojiBackfill', value: Date.now() })
  })
}

/**
 * De-dupes concurrent callers within this tab: React's <StrictMode> runs mount
 * effects twice in dev, so `seedIfEmpty` would otherwise be invoked twice.
 */
let seeding: Promise<void> | null = null

export function seedIfEmpty(): Promise<void> {
  seeding ??= runSeed().finally(() => {
    seeding = null
  })
  return seeding
}

/**
 * The emptiness check and the insert share one `rw` transaction: IndexedDB
 * serialises readwrite transactions over the same store, so a second caller
 * (another tab, or a re-entrant effect) sees the seeded rows and bails out.
 */
async function runSeed(): Promise<void> {
  await db.transaction('rw', db.routines, db.meta, async () => {
    if ((await db.routines.count()) > 0) return

    const now = Date.now()
    const rows: Routine[] = SEED.map((s, i) => ({
      id: newId(),
      name: s.name,
      emoji: s.emoji,
      order: i,
      activeDays: s.activeDays,
      time: s.time,
      archived: false,
      createdAt: now + i,
      updatedAt: now + i,
    }))

    await db.routines.bulkAdd(rows)
    await db.meta.put({ key: 'seededAt', value: now })
  })
}

type SeedLesson = Omit<Lesson, 'id' | 'createdAt' | 'updatedAt'>

/**
 * The user's timetable, inserted once when the `lessons` table is empty and
 * fully editable afterwards. `group` is the number after the slash in a subject
 * code ("MB142/09"); `name` keeps the bare code.
 */
const SEED_TIMETABLE: SeedLesson[] = [
  {
    day: 0,
    start: '18:00',
    end: '20:00',
    kind: 'seminar',
    name: 'PV028',
    group: 'CZ',
    room: 'KOM 200',
  },
  {
    day: 1,
    start: '08:00',
    end: '10:00',
    kind: 'seminar',
    name: 'MB142',
    group: '09',
    room: 'B204',
  },
  {
    day: 1,
    start: '10:00',
    end: '12:00',
    kind: 'seminar',
    name: 'PV170',
    group: '09',
    room: 'S405',
    onlyDates: ['2026-11-10'],
  },
  { day: 2, start: '08:00', end: '10:00', kind: 'lecture', name: 'MB142', room: 'A, 01026' },
  { day: 2, start: '10:00', end: '12:00', kind: 'lecture', name: 'PA015', room: 'A217' },
  { day: 2, start: '14:00', end: '16:00', kind: 'lecture', name: 'PB006', room: 'A318' },
  { day: 2, start: '18:00', end: '20:00', kind: 'lecture', name: 'PV170', room: 'Fast/D182' },
  {
    day: 3,
    start: '14:00',
    end: '16:00',
    kind: 'lab',
    name: 'CORE100',
    room: 'G32',
    skipDates: ['2026-11-19'],
  },
  { day: 4, start: '08:00', end: '10:00', kind: 'lecture', name: 'PB007', room: '140' },
  {
    day: 4,
    start: '10:00',
    end: '12:00',
    kind: 'seminar',
    name: 'PB007',
    group: '34',
    room: 'A215',
  },
]

let seedingTimetable: Promise<void> | null = null

/** Same in-flight guard as `seedIfEmpty` — <StrictMode> calls this twice in dev. */
export function seedTimetableIfEmpty(): Promise<void> {
  seedingTimetable ??= runTimetableSeed().finally(() => {
    seedingTimetable = null
  })
  return seedingTimetable
}

async function runTimetableSeed(): Promise<void> {
  await db.transaction('rw', db.lessons, db.meta, async () => {
    if ((await db.lessons.count()) > 0) return

    const now = Date.now()
    const rows: Lesson[] = SEED_TIMETABLE.map((l, i) => ({
      id: newId(),
      createdAt: now + i,
      updatedAt: now + i,
      ...l,
    }))

    await db.lessons.bulkAdd(rows)
    await db.meta.put({ key: 'timetableSeededAt', value: now })
  })
}

/**
 * Per-date exceptions for timetables seeded before those fields existed.
 * Matched on the weekly slot (code + weekday + start) rather than an id, since
 * ids are generated per install. Runs once, guarded by a `meta` flag, and never
 * touches a lesson that already carries exceptions of its own.
 */
const SEED_EXCEPTIONS: {
  name: string
  day: WeekdayIndex
  start: string
  fields: Pick<Lesson, 'skipDates' | 'onlyDates'>
}[] = [
  { name: 'PV170', day: 1, start: '10:00', fields: { onlyDates: ['2026-11-10'] } },
  { name: 'CORE100', day: 3, start: '14:00', fields: { skipDates: ['2026-11-19'] } },
]

export async function backfillLessonExceptions(): Promise<void> {
  const done = await db.meta.get('lessonExceptions1')
  if (done) return

  await db.transaction('rw', db.lessons, db.meta, async () => {
    const all = await db.lessons.toArray()
    for (const e of SEED_EXCEPTIONS) {
      const match = all.find((l) => l.name === e.name && l.day === e.day && l.start === e.start)
      if (!match) continue
      if (match.skipDates?.length || match.onlyDates?.length) continue
      await db.lessons.update(match.id, e.fields)
    }
    await db.meta.put({ key: 'lessonExceptions1', value: Date.now() })
  })
}

type SeedFolder = Pick<TodoFolder, 'name' | 'emoji'> & { isDefault?: boolean }

/**
 * The user's todo categories, inserted once when the `todoFolders` table is
 * empty and fully editable afterwards. "Others" is flagged `isDefault`, so it
 * is the catch-all a new todo lands in — the role the "Unsorted" bucket
 * plays when no folder exists — and therefore sits last.
 */
const SEED_FOLDERS: SeedFolder[] = [
  { name: 'DiD', emoji: '🕹️' },
  { name: 'DnD', emoji: '🎲' },
  { name: 'School', emoji: '📚' },
  { name: 'Job', emoji: '💼' },
  { name: 'Others', emoji: '📦', isDefault: true },
]

let seedingFolders: Promise<void> | null = null

/** Same in-flight guard as `seedIfEmpty` — <StrictMode> calls this twice in dev. */
export function seedTodoFoldersIfEmpty(): Promise<void> {
  seedingFolders ??= runFolderSeed().finally(() => {
    seedingFolders = null
  })
  return seedingFolders
}

async function runFolderSeed(): Promise<void> {
  await db.transaction('rw', db.todoFolders, db.meta, async () => {
    if ((await db.todoFolders.count()) > 0) return

    const now = Date.now()
    const rows: TodoFolder[] = SEED_FOLDERS.map((f, i) => ({
      id: newId(),
      name: f.name,
      emoji: f.emoji,
      order: i,
      isDefault: f.isDefault,
      createdAt: now + i,
      updatedAt: now + i,
    }))

    await db.todoFolders.bulkAdd(rows)
    await db.meta.put({ key: 'todoFoldersSeededAt', value: now })
  })
}
