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

/**
 * Tap cycle. 1 tap = done (green), 2 = missed (red), 3 = busy / "couldn't be
 * done" (blue).
 *
 * Today/future: undefined → done → missed → busy → undefined (empty box).
 *
 * Past: an unmarked cell already renders as `missed` (derived, see
 * `resolveCellState`), so there the cycle runs over the VISIBLE state and
 * rotates missed → busy → done → missed. The empty step is dropped: it looks
 * identical to red and would stall a tap. A past cell therefore keeps an entry
 * once marked — cleared and `missed` read the same on screen and count the
 * same in the stats, so nothing observable changes.
 */
export function nextStatus(
  current: RoutineStatus | undefined,
  isPast: boolean,
): RoutineStatus | undefined {
  if (isPast) {
    switch (current ?? 'missed') {
      case 'missed':
        return 'busy'
      case 'busy':
        return 'done'
      case 'done':
        return 'missed'
    }
  }

  switch (current) {
    case undefined:
      return 'done'
    case 'done':
      return 'missed'
    case 'missed':
      return 'busy'
    case 'busy':
      return undefined
  }
}

/** Minutes since midnight for a "H:MM"/"HH:MM" string; blank sorts last. */
export function timeToMinutes(time: string | undefined): number {
  if (!time) return 24 * 60 + 1
  const [h, m] = time.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** Column ordering: manual `order` (set by drag), then time, then name. */
export function compareRoutines(a: Routine, b: Routine): number {
  if (a.order !== b.order) return a.order - b.order
  const ta = timeToMinutes(a.time)
  const tb = timeToMinutes(b.time)
  if (ta !== tb) return ta - tb
  return a.name.localeCompare(b.name)
}
