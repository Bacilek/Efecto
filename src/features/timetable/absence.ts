import type { Lesson } from '@/db/db'
import { SEMESTER_END, SEMESTER_START } from './semester'

/** How an `absenceLimit` lesson stands: how many skips are spent and how many are left. */
export interface AbsenceState {
  limit: number
  used: number
  left: number
}

/**
 * Seminars and labs usually allow a few excused absences. The allowance is per
 * semester, so `absentDates` outside the current one are ignored — bumping
 * `SEMESTER_START` / `SEMESTER_END` resets the count on its own, without
 * anyone having to clear last term's dates.
 *
 * Returns null for a lesson with no allowance, which is most of them.
 */
export function absenceState(lesson: Lesson): AbsenceState | null {
  if (!lesson.absenceLimit) return null
  const used = absencesThisSemester(lesson).length
  return { limit: lesson.absenceLimit, used, left: Math.max(0, lesson.absenceLimit - used) }
}

/** The lesson's absences that fall inside the current semester, in date order. */
export function absencesThisSemester(lesson: Lesson): string[] {
  return (lesson.absentDates ?? []).filter((d) => d >= SEMESTER_START && d <= SEMESTER_END).sort()
}

/** Whether the lesson was missed on that date. */
export function wasAbsent(lesson: Lesson, dateISO: string): boolean {
  return lesson.absentDates?.includes(dateISO) ?? false
}

/** The field that records — or takes back — an absence on one date. */
export function toggledAbsence(lesson: Lesson, dateISO: string): Partial<Lesson> {
  const dates = lesson.absentDates ?? []
  return {
    absentDates: dates.includes(dateISO)
      ? dates.filter((d) => d !== dateISO)
      : [...dates, dateISO].sort(),
  }
}
