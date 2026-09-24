import type { Lesson } from '@/db/db'
import { SEMESTER_END, SEMESTER_START } from './semester'
import { stampedCover } from './cover'

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

/**
 * The fields that record — or take back — an absence on one date.
 *
 * The two lists are the mirror of each other, so each edit settles both: being
 * there covers the occurrence, and missing it un-covers one previously ticked
 * off. Taking an absence back without covering the date would leave it neither
 * absent nor covered, which is exactly what `pendingSeminarAbsences` treats as
 * an unsettled past seminar — so the absence would simply be recorded again
 * the next time the Todos screen mounted, and the dot would come back red.
 */
export function toggledAbsence(lesson: Lesson, dateISO: string): Partial<Lesson> {
  const dates = lesson.absentDates ?? []
  const covered = lesson.coveredDates ?? []
  if (dates.includes(dateISO)) {
    return {
      absentDates: dates.filter((d) => d !== dateISO),
      coveredDates: covered.includes(dateISO) ? covered : [...covered, dateISO],
      coveredAt: stampedCover(lesson, dateISO, true),
    }
  }
  return {
    absentDates: [...dates, dateISO].sort(),
    coveredDates: covered.filter((d) => d !== dateISO),
    coveredAt: stampedCover(lesson, dateISO, false),
  }
}
