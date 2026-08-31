import { db, newId, type Routine } from './db'
import type { WeekdayIndex } from '@/lib/date'

const ALL: WeekdayIndex[] = [0, 1, 2, 3, 4, 5, 6]
const WEEKDAYS: WeekdayIndex[] = [0, 1, 2, 3, 4]
const WEEKEND: WeekdayIndex[] = [5, 6]
const GYM: WeekdayIndex[] = [0, 1, 3, 4] // Po, Út, Čt, Pá

type SeedRoutine = Pick<Routine, 'name' | 'activeDays'> & { time?: string; emoji?: string }

/**
 * Default routines carried over from the original prototype. They are inserted
 * only once (when the routines table is empty) and are fully editable afterwards.
 */
const SEED: SeedRoutine[] = [
  { name: 'Letrox nalačno', emoji: '💊', time: '6:00', activeDays: ALL },
  { name: 'Gym', emoji: '🏋️', time: '7:40', activeDays: GYM },
  { name: 'Práce / SOC', emoji: '💼', time: '9:40', activeDays: WEEKDAYS },
  { name: 'Godot / Claude Code', emoji: '🖥️', time: '19:00', activeDays: ALL },
  { name: 'Wizard Wars', emoji: '🎮', time: '20:00', activeDays: ALL },
  { name: 'Studium / úkoly', emoji: '📚', time: '20:00', activeDays: WEEKDAYS },
  { name: 'Trading review', emoji: '📈', time: '21:00', activeDays: ALL },
  { name: 'Kalorie goal', emoji: '🍽️', activeDays: ALL },
  { name: 'Protein goal', emoji: '🥩', activeDays: ALL },
  { name: 'Kreatin', emoji: '💪', activeDays: ALL },
  { name: 'D&D session', emoji: '🎲', activeDays: WEEKEND },
  { name: 'Jít spát', emoji: '😴', time: '23:00', activeDays: ALL },
]

/**
 * Backfill `emoji` on routines created before emojis existed. Matches the known
 * seed names; runs once (guarded by a `meta` flag). Safe to keep around — it
 * never overwrites an emoji the user already set.
 */
export async function backfillEmojis(): Promise<void> {
  const done = await db.meta.get('emojiBackfill')
  if (done) return

  const byName = new Map(SEED.map((s) => [s.name, s.emoji]))
  await db.transaction('rw', db.routines, db.meta, async () => {
    const all = await db.routines.toArray()
    for (const r of all) {
      if (r.emoji) continue
      const emoji = byName.get(r.name)
      if (emoji) await db.routines.update(r.id, { emoji })
    }
    await db.meta.put({ key: 'emojiBackfill', value: Date.now() })
  })
}

export async function seedIfEmpty(): Promise<void> {
  const count = await db.routines.count()
  if (count > 0) return

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
}
