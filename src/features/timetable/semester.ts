import { addDays, fromISODate, weeksBetween } from '@/lib/date'

/**
 * The semester's bounds. Hard-coded on purpose — there is nowhere to configure
 * them yet, so they need editing once per semester. `SEMESTER_START` must be a
 * Monday; `SEMESTER_END` may fall anywhere in the final week.
 */
export const SEMESTER_START = '2026-09-14'
export const SEMESTER_END = '2026-12-18'

export function semesterStart(): Date {
  return fromISODate(SEMESTER_START)
}

export function semesterEnd(): Date {
  return fromISODate(SEMESTER_END)
}

/** How many weeks the semester runs for, counting both edge weeks. */
export function semesterWeekCount(): number {
  return weeksBetween(semesterStart(), semesterEnd()) + 1
}

/** Monday of semester week `week` (1-based). */
export function semesterWeekMonday(week: number): Date {
  return addDays(semesterStart(), (week - 1) * 7)
}

/**
 * Which week of the semester `date` falls in, 1-based, or null when it falls
 * outside the semester altogether. Counted between Mondays, so the whole first
 * week is week 1.
 */
export function semesterWeek(date: Date): number | null {
  const week = weeksBetween(semesterStart(), date) + 1
  return week < 1 || week > semesterWeekCount() ? null : week
}
