import { fromISODate, weeksBetween } from '@/lib/date'

/**
 * Monday the semester starts on. Hard-coded on purpose — there is nowhere to
 * configure it yet, so it needs editing once per semester.
 */
export const SEMESTER_START = '2026-09-14'

export function semesterStart(): Date {
  return fromISODate(SEMESTER_START)
}

/**
 * Which week of the semester `date` falls in, 1-based, or null before it starts.
 * Counted between Mondays, so the whole first week is week 1.
 */
export function semesterWeek(date: Date): number | null {
  const week = weeksBetween(semesterStart(), date) + 1
  return week < 1 ? null : week
}
