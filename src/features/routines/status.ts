import type { Entry, Routine, RoutineStatus } from '@/db/db'
import { toISODate, weekdayIndex } from '@/lib/date'

/**
 * What a cell shows for a routine on a given date.
 * - `off`     — routine not scheduled that weekday (gray dash, not tappable)
 * - `pending` — today/future, not marked yet (empty box)
 * - `done` / `busy` / `missed` — explicit mark, OR `missed` derived for a past
 *   day that was left unmarked ("auto red at end of day")
 */
export type CellState = RoutineStatus | 'off' | 'pending'

export function resolveCellState(
  routine: Routine,
  date: Date,
  entry: Entry | undefined,
  todayISO: string,
): CellState {
  if (!routine.activeDays.includes(weekdayIndex(date))) return 'off'
  if (entry) return entry.status
  return toISODate(date) < todayISO ? 'missed' : 'pending'
}

/** Tap cycle for the STORED status. pending → done → busy → missed → (cleared). */
export function nextStatus(current: RoutineStatus | undefined): RoutineStatus | undefined {
  switch (current) {
    case undefined:
      return 'done'
    case 'done':
      return 'busy'
    case 'busy':
      return 'missed'
    case 'missed':
      return undefined
  }
}

/** Minutes since midnight for a "H:MM"/"HH:MM" string; blank sorts last. */
export function timeToMinutes(time: string | undefined): number {
  if (!time) return 24 * 60 + 1
  const [h, m] = time.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** Column ordering: by time (blank last), then manual order, then name. */
export function compareRoutines(a: Routine, b: Routine): number {
  const ta = timeToMinutes(a.time)
  const tb = timeToMinutes(b.time)
  if (ta !== tb) return ta - tb
  if (a.order !== b.order) return a.order - b.order
  return a.name.localeCompare(b.name)
}
