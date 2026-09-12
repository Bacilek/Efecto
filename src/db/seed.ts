import { db, newId, type Routine } from './db'
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
    }))

    await db.routines.bulkAdd(rows)
    await db.meta.put({ key: 'seededAt', value: now })
  })
}
