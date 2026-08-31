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
