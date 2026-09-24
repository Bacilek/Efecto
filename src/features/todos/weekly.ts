import type { Todo } from '@/db/db'
import { addDays, fromISODate, toISODate, weekdayIndex, type WeekdayIndex } from '@/lib/date'
import {
  semesterEnd,
  semesterStart,
  semesterWeek,
  semesterWeekCount,
} from '@/features/timetable/semester'

export interface WeeklyOccurrence {
  todo: Todo
  /** the cycle's own closing date — the key into `completedDates` */
  date: string
  /** 1-based semester week, or null outside the semester */
  week: number | null
}

/**
 * Is this the weekly-occurrence flavour? `weeklySince` being set *is* the
 * discriminator — it is the field the flavour needs anyway (the week to start
 * counting from), so there is no separate flag that could contradict it.
 */
export function isWeekly(todo: Todo): boolean {
  return todo.weeklySince !== undefined
}

/** Ticked for the week starting `mondayISO`? */
export function weekDone(todo: Todo, mondayISO: string): boolean {
  return todo.completedDates?.includes(mondayISO) ?? false
}

/**
 * Was *this* week the one just ticked? `completedDates` carries no timestamp
 * map like `Lesson.coveredAt`, and it doesn't need one: a tick always appends
 * and always stamps `doneAt`, so "the last entry, stamped today" is exactly
 * the tap that just happened — which is all the grace has to identify.
 *
 * (Untick-then-tick-a-different-week within one day reorders the array, so an
 * older row can briefly keep its grace. Harmless: a row lingers a few taps
 * longer than strictly needed, never disappears early.)
 */
function justTicked(todo: Todo, mondayISO: string, todayISO: string): boolean {
  const last = todo.completedDates?.at(-1)
  return (
    last === mondayISO && todo.doneAt !== undefined && toISODate(new Date(todo.doneAt)) === todayISO
  )
}

/** The weekday a cycle starting on `sinceISO` closes on. */
export function weekdayOf(sinceISO: string): WeekdayIndex {
  return weekdayIndex(fromISODate(sinceISO))
}

/** The weekday a weekly todo's cycles close on, taken from its own start. */
export function weeklyWeekday(todo: Todo): WeekdayIndex {
  return weekdayOf(todo.weeklySince!)
}

/**
 * The cycle a weekly todo is *currently* inside: the next closing date on or
 * after today. A cycle runs up to its closing day inclusive, so the day the
 * week closes is still part of it — it only falls behind the day after.
 *
 * Deliberately not `today.ts`'s `nextOccurrenceISO`, identical though the
 * maths is: `today.ts` already imports from here, and borrowing it back would
 * close a cycle between the two modules for three lines.
 */
export function currentAnchor(todo: Todo, todayISO: string): string {
  return nextWeekdayISO(weeklyWeekday(todo), todayISO)
}

/** The next date on or after `todayISO` landing on `weekday`. */
function nextWeekdayISO(weekday: WeekdayIndex, todayISO: string): string {
  const today = fromISODate(todayISO)
  return toISODate(addDays(today, (weekday - weekdayIndex(today) + 7) % 7))
}

/**
 * Which semester week a cycle *belongs* to, from its closing date.
 *
 * Not the week the closing date itself falls in: a cycle closing on Monday
 * 28.09 runs from Tuesday 22.09, so it is week 2's work even though 28.09 is
 * already week 3 — and numbering it 3 while the classes it follows still read
 * `#L2` was simply wrong. Counted from the day the cycle opened, which is the
 * week you are actually working through.
 */
export function cycleWeek(closingISO: string): number | null {
  return semesterWeek(addDays(fromISODate(closingISO), -6))
}

/** A cycle whose closing day has passed — what turns its date red. */
export function weeklyStale(dateISO: string, todayISO: string): boolean {
  return dateISO < todayISO
}

/**
 * Every cycle a weekly todo is still owed for, oldest first — the one it is
 * inside now, plus every earlier one nobody ticked, the way
 * `lessonOccurrences` accumulates uncovered classes. A cycle ticked just now
 * still shows, struck through, so a mistaken tap has something to undo.
 *
 * Cycles close on the weekday `weeklySince` falls on, not on a Sunday: a
 * subject that meets on Wednesday owes its week's work by Wednesday, and a
 * Monday-to-Sunday week would have said otherwise for every subject that
 * doesn't meet on a Monday.
 *
 * The start is clamped into the semester, and that clamp is not optional:
 * when `SEMESTER_START`/`SEMESTER_END` are moved on to the next term, a
 * surviving todo's `weeklySince` points into the old one, and an unclamped
 * walk would emit every cycle of the gap at once. Clamped, it restarts inside
 * the new term — the old term's `completedDates` are dates no new cycle ever
 * keys, so they sit there inert.
 */
export function weeklyOccurrences(todos: Todo[], todayISO: string): WeeklyOccurrence[] {
  const cap = semesterWeekCount()
  const lastDay = toISODate(semesterEnd())

  const result: WeeklyOccurrence[] = []
  for (const todo of todos) {
    if (!isWeekly(todo)) continue
    const anchor = currentAnchor(todo, todayISO)
    // Nothing is owed past the end of term; before it, the cycle we're in.
    const end = anchor < lastDay ? anchor : lastDay
    let iso = todo.weeklySince!
    // A start before the semester would spill the whole gap — walk it forward
    // a week at a time until it lands inside.
    const floor = toISODate(semesterStart())
    while (iso < floor) iso = toISODate(addDays(fromISODate(iso), 7))

    for (let n = 0; iso <= end && n <= cap; n++) {
      if (iso === anchor || !weekDone(todo, iso) || justTicked(todo, iso, todayISO)) {
        result.push({ todo, date: iso, week: cycleWeek(iso) })
      }
      iso = toISODate(addDays(fromISODate(iso), 7))
    }
  }
  return result
}

/**
 * Ticks one week off, or clears it.
 *
 * `done` mirrors *this* week only, so every generic aggregate that asks
 * `!todo.done` — the folder tile's count, `sortTodos`, the plain folder list —
 * keeps working untouched and keeps answering "is there anything outstanding
 * this week". The backlog of earlier weeks lives in `completedDates` alone and
 * is a concern only for the subject-scoped views that render occurrences.
 * Ticking a *backlog* week therefore must not claim this week is finished.
 */
export function weeklyTogglePatch(
  todo: Todo,
  mondayISO: string,
  done: boolean,
  todayISO: string,
): Partial<Todo> {
  const dates = todo.completedDates ?? []
  const patch: Partial<Todo> = {
    completedDates: done
      ? dates.includes(mondayISO)
        ? dates
        : [...dates.filter((d) => d !== mondayISO), mondayISO]
      : dates.filter((d) => d !== mondayISO),
    // Stamped on every tick, backlog included — `justTicked` reads it, and
    // `doneAt` is only ever interpreted alongside `done`, which stays put.
    doneAt: done ? Date.now() : undefined,
  }
  if (mondayISO === currentAnchor(todo, todayISO)) patch.done = done
  return patch
}

/**
 * Re-arms the weekly flavour when the week turns over: `done` cached last
 * week's tick, and this week is owed again. The deadline flavour's equivalent
 * is `dueRolloverPatch`.
 */
export function weeklyRolloverPatch(todo: Todo, todayISO: string): Partial<Todo> | null {
  if (!isWeekly(todo) || !todo.done) return null
  if (weekDone(todo, currentAnchor(todo, todayISO))) return null
  return { done: false, doneAt: undefined }
}

/** The first closing date for a weekly todo set to close on `weekday`. */
export function weeklyStartFor(weekday: WeekdayIndex, todayISO: string): string {
  return nextWeekdayISO(weekday, todayISO)
}

/** Move a start to a different closing weekday, keeping its own week. */
export function withWeekday(sinceISO: string, weekday: WeekdayIndex): string {
  const diff = weekday - weekdayIndex(fromISODate(sinceISO))
  return toISODate(addDays(fromISODate(sinceISO), diff))
}
