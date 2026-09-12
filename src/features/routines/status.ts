import type { Entry, Routine, RoutineStatus } from '@/db/db'
import { toISODate, weekdayIndex, type WeekParity } from '@/lib/date'
import { timeToMinutes } from '@/lib/time'

/**
 * What a cell shows for a routine on a given date.
 * - `off`     — routine not scheduled that weekday (gray dash, not tappable)
 * - `pending` — today/future, not marked yet (empty box)
 * - `done` / `missed` — explicit mark, OR `missed` derived for a past day that
 *   was left unmarked ("auto red at end of day")
 * - `busy`    — excused skip: neither pass nor fail, excluded from the stats
 */
export type CellState = RoutineStatus | 'off' | 'pending'

export function resolveCellState(
  routine: Routine,
  date: Date,
  entry: Entry | undefined,
  todayISO: string,
  parity: WeekParity | null = null,
): CellState {
  // a routine bound to the other parity doesn't apply anywhere in this week
  if (routine.weeks && parity && routine.weeks !== parity) return 'off'

  if (routine.timesPerWeek) {
    // A weekly target owes no particular day, so every day is markable and an
    // unmarked past day is NOT a miss — missing the target is a weekly fact,
    // accounted for in `weekCompletion`, not something a single cell can show.
    return entry ? entry.status : 'pending'
  }

  if (!routine.activeDays.includes(weekdayIndex(date))) return 'off'
  if (entry) return entry.status
  return toISODate(date) < todayISO ? 'missed' : 'pending'
}

/**
 * Tap cycle. 1 tap = done (green), 2 = missed (red), 3 = busy (blue) — an
 * excused skip, which `dayCompletion` leaves out of the percentage.
 *
 * Normally: undefined → done → missed → busy → undefined (empty box).
 *
 * When clearing the cell would render as `missed` anyway — a past day on a
 * day-bound routine, see `resolveCellState` — the empty step is invisible and
 * gets dropped: the cycle runs over the VISIBLE state and rotates
 * missed → busy → done → missed. Such a cell keeps an entry once marked, which
 * changes nothing observable, since cleared and `missed` read the same on
 * screen and count the same in the stats.
 *
 * Pass `clearsToMissed` rather than "is it past": a weekly-target routine
 * derives no miss, so its past cells do have a visible empty step.
 */
export function nextStatus(
  current: RoutineStatus | undefined,
  clearsToMissed: boolean,
): RoutineStatus | undefined {
  if (clearsToMissed) {
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

/** Minutes since midnight, with a blank time sorting last. */
function orderTime(time: string | undefined): number {
  return time ? timeToMinutes(time) : 24 * 60 + 1
}

/** Column ordering: manual `order` (set by drag), then time, then name. */
export function compareRoutines(a: Routine, b: Routine): number {
  if (a.order !== b.order) return a.order - b.order
  const ta = orderTime(a.time)
  const tb = orderTime(b.time)
  if (ta !== tb) return ta - tb
  return a.name.localeCompare(b.name)
}
