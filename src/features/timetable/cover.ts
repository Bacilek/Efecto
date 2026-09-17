import type { Lesson, LessonCover } from '@/db/db'
import { fromISODate, weekdayIndex, weekParity } from '@/lib/date'
import { timeToMinutes } from '@/lib/time'
import { happensOn } from './occurrence'
import { semesterWeek } from './semester'

export const COVERS: LessonCover[] = ['attended', 'stream', 'recording', 'known']

export const COVER_LABELS: Record<LessonCover, string> = {
  attended: 'Attended',
  stream: 'Watched live',
  recording: 'Watched recording',
  known: 'Know it already',
}

/**
 * The lessons that actually run on `dateISO`, by start time — what the Todos
 * Today tab lists as classes. Nothing outside the semester or at the weekend:
 * the timetable is a weekday template for the current term only.
 */
export function lessonsOn(lessons: Lesson[], dateISO: string): Lesson[] {
  const date = fromISODate(dateISO)
  const week = semesterWeek(date)
  if (week === null) return []
  const day = weekdayIndex(date)
  const parity = weekParity(week)
  return lessons
    .filter((l) => l.day === day && happensOn(l, dateISO, parity))
    .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start))
}

export function coverOn(lesson: Lesson, dateISO: string): LessonCover | undefined {
  return lesson.coveredDates?.[dateISO]
}

/**
 * The fields that tick one occurrence off (or clear it, with null). Being there
 * in person contradicts a recorded absence, so `attended` takes that back too.
 */
export function coverPatch(
  lesson: Lesson,
  dateISO: string,
  cover: LessonCover | null,
): Partial<Lesson> {
  const covered = { ...lesson.coveredDates }
  if (cover) covered[dateISO] = cover
  else delete covered[dateISO]
  const patch: Partial<Lesson> = {
    coveredDates: Object.keys(covered).length ? covered : undefined,
  }
  if (cover === 'attended' && lesson.absentDates?.includes(dateISO)) {
    patch.absentDates = lesson.absentDates.filter((d) => d !== dateISO)
  }
  return patch
}
