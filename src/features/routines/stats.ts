import type { Entry, Routine } from '@/db/db'
import { entryId } from '@/db/db'
import { toISODate } from '@/lib/date'
import { resolveCellState } from './status'

export interface Completion {
  /** cells resolved to `done` */
  done: number
  /** routines that applied (everything except off-days) */
  total: number
  /** `done / total` as a rounded 0..100 percentage; 0 when nothing applied */
  pct: number
}

function toPct(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100)
}

/**
 * Completion for a single day: how many routines active that weekday resolved to
 * `done`. `busy` and `missed` (and past unmarked) count against the total.
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
    if (state === 'off') continue
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
