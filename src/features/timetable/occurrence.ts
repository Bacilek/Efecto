import type { Lesson } from '@/db/db'

/**
 * Whether a lesson actually takes place on `dateISO`.
 *
 * The timetable is a weekly template, so a lesson happens on every matching
 * weekday by default. Two per-date exceptions override that: `onlyDates`
 * restricts it to an explicit list, while `skipDates` cancels individual dates.
 *
 * Merely *having* `onlyDates` makes it a whitelist and takes precedence — so an
 * empty one means the lesson never runs. Treating empty as "no restriction"
 * would turn cancelling the last listed date into "runs every week", the
 * opposite of what that tap asked for. The block is still drawn as a ghost, so
 * a date can always be added back.
 */
export function happensOn(lesson: Lesson, dateISO: string): boolean {
  if (lesson.onlyDates) return lesson.onlyDates.includes(dateISO)
  return !lesson.skipDates?.includes(dateISO)
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
