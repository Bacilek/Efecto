import type { Lesson } from '@/db/db'
import { addDays, fromISODate, mondayOf, toISODate, weekdayIndex, weekParity } from '@/lib/date'
import { timeToMinutes } from '@/lib/time'
import { happensOn } from './occurrence'
import { semesterEnd, semesterStart, semesterWeek } from './semester'

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

export function coverOn(lesson: Lesson, dateISO: string): boolean {
  return lesson.coveredDates?.includes(dateISO) ?? false
}

/**
 * Ticks an occurrence off, or clears it. Seeing it contradicts a recorded
 * absence for the same date, so ticking it off takes that back too.
 */
export function coverPatch(lesson: Lesson, dateISO: string, covered: boolean): Partial<Lesson> {
  const dates = lesson.coveredDates ?? []
  const patch: Partial<Lesson> = {
    coveredDates: covered
      ? dates.includes(dateISO)
        ? dates
        : [...dates, dateISO]
      : dates.filter((d) => d !== dateISO),
    coveredAt: stampedCover(lesson, dateISO, covered),
  }
  if (covered && lesson.absentDates?.includes(dateISO)) {
    patch.absentDates = lesson.absentDates.filter((d) => d !== dateISO)
  }
  return patch
}

/**
 * `coveredAt` with this date's tick time written or dropped. Kept in step with
 * `coveredDates` by every writer, so the two never disagree about which
 * occurrences are ticked.
 */
export function stampedCover(
  lesson: Lesson,
  dateISO: string,
  covered: boolean,
): Record<string, number> {
  const at = { ...(lesson.coveredAt ?? {}) }
  if (covered) at[dateISO] = Date.now()
  else delete at[dateISO]
  return at
}

/**
 * Whether the occurrence is left over from an *earlier week*, not merely an
 * earlier day. A Monday lecture still open on Wednesday is this week's work
 * running late; one still open the week after has slipped a whole cycle of the
 * timetable and is about to be lapped by the same class again — so Today marks
 * only the latter in red. Compared by the Monday each date belongs to rather
 * than by `semesterWeek`, which is null outside the semester and would leave
 * the comparison undecidable there.
 */
export function isFromEarlierWeek(dateISO: string, todayISO: string): boolean {
  return toISODate(mondayOf(fromISODate(dateISO))) < toISODate(mondayOf(fromISODate(todayISO)))
}

/** A tracked seminar: missing it costs one of a limited number of excuses. */
export function isTrackedSeminar(lesson: Lesson): boolean {
  return lesson.kind === 'seminar' && !!lesson.absenceLimit
}

export interface LessonOccurrence {
  lesson: Lesson
  date: string
}

/**
 * Was *this occurrence* ticked today? It has to be asked per date, not per
 * lesson: the timetable is a weekly template, so every week of the same class
 * shares one row, and leaning on that row's `updatedAt` meant ticking this
 * week's lecture dragged every earlier covered week of the same subject back
 * onto Today, long after they should have gone.
 *
 * A covered date with no `coveredAt` entry predates the stamp, so it reads as
 * ticked long ago — right for old data, which by definition wasn't ticked
 * just now.
 */
function coveredToday(lesson: Lesson, dateISO: string, todayISO: string): boolean {
  const at = lesson.coveredAt?.[dateISO]
  return at !== undefined && toISODate(new Date(at)) === todayISO
}

/**
 * Today's classes, plus every earlier lecture or lab nobody covered yet — it
 * carries over exactly like a planned todo: an open one keeps showing on every
 * later day until it's marked, while one covered on its own day drops off the
 * day after, the same as a todo ticked on an earlier day.
 *
 * "Its own day" means the day it was *ticked*, not the day it was scheduled
 * for — a carried-over occurrence ticked today has to stay visible (struck
 * through) for the rest of today the same as ticking it on its original day
 * would, or a mistaken tap has nothing to undo: the row is just gone, and
 * with it the whole subject group on Today if it was the only open thing in
 * it. `coveredToday` is what tells "just ticked" apart from "covered a while
 * ago, should already be gone".
 *
 * A tracked seminar (one with an `absenceLimit`) never lingers this way — see
 * `pendingSeminarAbsences`, which settles it straight into a recorded absence
 * instead, since missing a seminar has a real cost rather than just being
 * something to catch up on later.
 */
export function lessonOccurrences(lessons: Lesson[], todayISO: string): LessonOccurrence[] {
  const today = fromISODate(todayISO)
  const rangeEnd = today < semesterEnd() ? today : semesterEnd()
  const result: LessonOccurrence[] = []
  for (let d = semesterStart(); d <= rangeEnd; d = addDays(d, 1)) {
    const iso = toISODate(d)
    for (const lesson of lessonsOn(lessons, iso)) {
      if (isTrackedSeminar(lesson) && iso !== todayISO) continue
      if (iso === todayISO || !coverOn(lesson, iso) || coveredToday(lesson, iso, todayISO)) {
        result.push({ lesson, date: iso })
      }
    }
  }
  return result
}

/**
 * Past tracked-seminar occurrences nobody covered and that aren't recorded as
 * an absence yet — the ones `lessonOccurrences` leaves out of Today because
 * they settle into `absentDates` instead of lingering as an open item.
 */
export function pendingSeminarAbsences(lessons: Lesson[], todayISO: string): LessonOccurrence[] {
  const today = fromISODate(todayISO)
  const rangeEnd = today < semesterEnd() ? today : semesterEnd()
  const result: LessonOccurrence[] = []
  for (let d = semesterStart(); d < today && d <= rangeEnd; d = addDays(d, 1)) {
    const iso = toISODate(d)
    for (const lesson of lessonsOn(lessons, iso)) {
      if (isTrackedSeminar(lesson) && !coverOn(lesson, iso) && !lesson.absentDates?.includes(iso)) {
        result.push({ lesson, date: iso })
      }
    }
  }
  return result
}
