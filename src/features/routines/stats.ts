import type { Entry, Routine } from '@/db/db'
import { entryId } from '@/db/db'
import { toISODate } from '@/lib/date'
import { resolveCellState } from './status'

export interface Completion {
  /** cells resolved to `done` */
  done: number
  /** routines that counted (everything except off-days and excused `busy`) */
  total: number
  /** `done / total` as a rounded 0..100 percentage; 0 when nothing applied */
  pct: number
}

function toPct(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100)
}

/**
 * Completion for a single day: how many routines active that weekday resolved to
 * `done`. `missed` (and past unmarked) counts against the total; `busy` is an
 * excused skip and drops out of the ratio entirely, like an off-day — it can
 * neither raise nor lower the percentage.
 */
export function dayCompletion(
  routines: Routine[],
  date: Date,
  entries: Map<string, Entry>,
  todayISO: string,
): Completion {
  const dISO = toISODate(date)
  let done = 0
  let total = 0
  for (const r of routines) {
    const state = resolveCellState(r, date, entries.get(entryId(r.id, dISO)), todayISO)
    // `off` never applied; `busy` is excused after the fact. Both leave the ratio.
    if (state === 'off' || state === 'busy') continue
    total++
    if (state === 'done') done++
  }
  return { done, total, pct: toPct(done, total) }
}

/** Completion across the whole week (sum of every day's applied routines). */
export function weekCompletion(
  routines: Routine[],
  dates: Date[],
  entries: Map<string, Entry>,
  todayISO: string,
): Completion {
  let done = 0
  let total = 0
  for (const date of dates) {
    const c = dayCompletion(routines, date, entries, todayISO)
    done += c.done
    total += c.total
  }
  return { done, total, pct: toPct(done, total) }
}
