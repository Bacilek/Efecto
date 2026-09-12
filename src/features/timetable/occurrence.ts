import type { Lesson } from '@/db/db'
import type { WeekParity } from '@/lib/date'

/**
 * Whether a lesson actually takes place on `dateISO`, in a week of the given
 * parity (pass null when the date is outside the semester and no parity applies).
 *
 * The timetable is a weekly template, so a lesson happens on every matching
 * weekday by default. Three things narrow that, in this order:
 *
 * 1. `onlyDates` — an explicit whitelist. Merely *having* it makes it one, so an
 *    empty one means the lesson never runs. Treating empty as "no restriction"
 *    would turn cancelling the last listed date into "runs every week", the
 *    opposite of what that tap asked for. Listed dates beat everything below:
 *    naming a date is as explicit as it gets.
 * 2. `skipDates` — individual dates cancelled.
 * 3. `weeks` — odd or even semester weeks only.
 *
 * A lesson that doesn't happen is still drawn as a ghost, so any of these can be
 * undone from the grid.
 */
export function happensOn(lesson: Lesson, dateISO: string, parity: WeekParity | null): boolean {
  if (lesson.onlyDates) return lesson.onlyDates.includes(dateISO)
  if (lesson.skipDates?.includes(dateISO)) return false
  if (lesson.weeks && parity && lesson.weeks !== parity) return false
  return true
}

/**
 * The fields that flip one occurrence on or off — cancelling a normal lesson,
 * or adding/removing a date on a lesson that only runs on listed dates.
 */
export function toggledOccurrence(lesson: Lesson, dateISO: string): Partial<Lesson> {
  if (lesson.onlyDates) {
    const dates = lesson.onlyDates
    return {
      onlyDates: dates.includes(dateISO)
        ? dates.filter((d) => d !== dateISO)
        : [...dates, dateISO].sort(),
    }
  }

  const dates = lesson.skipDates ?? []
  return {
    skipDates: dates.includes(dateISO)
      ? dates.filter((d) => d !== dateISO)
      : [...dates, dateISO].sort(),
  }
}
