import type { Entry, Routine } from '@/db/db'
import { entryId } from '@/db/db'
import { toISODate, type WeekParity } from '@/lib/date'
import { resolveCellState } from './status'

export interface Completion {
  /** cells resolved to `done` */
  done: number
  /** routines that counted (everything except off-days and excused `busy`) */
  total: number
  /** `done / total` as a rounded 0..100 percentage; 100 when nothing counted */
  pct: number
}

/**
 * Nothing to do is a day fully done, so an empty ratio is 100 %, not 0 %: a day
 * with no routines scheduled — or one where every routine was excused — leaves
 * nothing outstanding and shouldn't read as a total failure.
 */
function toPct(done: number, total: number): number {
  return total === 0 ? 100 : Math.round((done / total) * 100)
}

/**
 * Completion for a single day: how many routines active that weekday resolved to
 * `done`. `missed` (and past unmarked) counts against the total; `busy` is an
 * excused skip and drops out of the ratio entirely, like an off-day — it can
 * neither raise nor lower the percentage.
 *
 * Weekly-target routines (`timesPerWeek`) are left out altogether: they owe no
 * particular day, so they can't raise or lower one day's percentage. They are
 * counted once for the whole week in `weekCompletion`.
 */
export function dayCompletion(
  routines: Routine[],
  date: Date,
  entries: Map<string, Entry>,
  todayISO: string,
  parity: WeekParity | null = null,
): Completion {
  const dISO = toISODate(date)
  let done = 0
  let total = 0
  for (const r of routines) {
    if (r.timesPerWeek) continue
    const state = resolveCellState(r, date, entries.get(entryId(r.id, dISO)), todayISO, parity)
    // `off` never applied; `busy` is excused after the fact. Both leave the ratio.
    if (state === 'off' || state === 'busy') continue
    total++
    if (state === 'done') done++
  }
  return { done, total, pct: toPct(done, total) }
}

/** Whether a routine applies at all in a week of this parity. */
export function appliesInWeek(routine: Routine, parity: WeekParity | null): boolean {
  return !(routine.weeks && parity && routine.weeks !== parity)
}

/**
 * How many of a weekly target's marks are in: `done` marks across the week,
 * capped at the target so extra sessions can't push the week over 100 %.
 */
export function weeklyTargetProgress(
  routine: Routine,
  dates: Date[],
  entries: Map<string, Entry>,
): { done: number; target: number } {
  const target = routine.timesPerWeek ?? 0
  const marks = dates.filter(
    (d) => entries.get(entryId(routine.id, toISODate(d)))?.status === 'done',
  ).length
  return { done: Math.min(marks, target), target }
}

/**
 * Completion across the whole week: every day's day-bound routines, plus each
 * weekly target counted once for the week rather than once per day.
 */
export function weekCompletion(
  routines: Routine[],
  dates: Date[],
  entries: Map<string, Entry>,
  todayISO: string,
  parity: WeekParity | null = null,
): Completion {
  let done = 0
  let total = 0

  for (const date of dates) {
    const c = dayCompletion(routines, date, entries, todayISO, parity)
    done += c.done
    total += c.total
  }

  for (const r of routines) {
    if (!r.timesPerWeek || !appliesInWeek(r, parity)) continue
    const p = weeklyTargetProgress(r, dates, entries)
    done += p.done
    total += p.target
  }

  return { done, total, pct: toPct(done, total) }
}
