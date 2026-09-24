import type { Todo } from '@/db/db'
import { addDays, fromISODate, mondayOf, toISODate } from '@/lib/date'
import {
  semesterEnd,
  semesterStart,
  semesterWeek,
  semesterWeekCount,
} from '@/features/timetable/semester'

export interface WeeklyOccurrence {
  todo: Todo
  /** Monday of the week it is owed for — the key into `completedDates` */
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

/**
 * Every week a weekly todo is still owed for, oldest first — this week's
 * always, plus every earlier week nobody ticked, exactly as
 * `lessonOccurrences` accumulates uncovered classes. A week ticked just now
 * still shows, struck through, so a mistaken tap has something to undo.
 *
 * The start is clamped to the semester's own first Monday, and that clamp is
 * not optional: when `SEMESTER_START`/`SEMESTER_END` are moved on to the next
 * term, a surviving todo's `weeklySince` points into the old one, and an
 * unclamped walk would emit every week of the gap at once. Clamped, it simply
 * restarts at week 1 of the new term — last term's `completedDates` entries
 * are Mondays no new week ever keys, so they sit there inert.
 */
export function weeklyOccurrences(todos: Todo[], todayISO: string): WeeklyOccurrence[] {
  const today = fromISODate(todayISO)
  const end = today < semesterEnd() ? today : semesterEnd()
  const rangeEnd = toISODate(mondayOf(end))
  const thisMonday = toISODate(mondayOf(today))
  const floor = toISODate(mondayOf(semesterStart()))
  const cap = semesterWeekCount()

  const result: WeeklyOccurrence[] = []
  for (const todo of todos) {
    if (!isWeekly(todo)) continue
    const since = toISODate(mondayOf(fromISODate(todo.weeklySince!)))
    let iso = since > floor ? since : floor
    for (let n = 0; iso <= rangeEnd && n <= cap; n++) {
      if (iso === thisMonday || !weekDone(todo, iso) || justTicked(todo, iso, todayISO)) {
        result.push({ todo, date: iso, week: semesterWeek(fromISODate(iso)) })
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
  if (mondayISO === toISODate(mondayOf(fromISODate(todayISO)))) patch.done = done
  return patch
}

/**
 * Re-arms the weekly flavour when the week turns over: `done` cached last
 * week's tick, and this week is owed again. The deadline flavour's equivalent
 * is `dueRolloverPatch`.
 */
export function weeklyRolloverPatch(todo: Todo, todayISO: string): Partial<Todo> | null {
  if (!isWeekly(todo) || !todo.done) return null
  const thisMonday = toISODate(mondayOf(fromISODate(todayISO)))
  if (weekDone(todo, thisMonday)) return null
  return { done: false, doneAt: undefined }
}

/** The Monday a weekly todo starting "now" is owed from. */
export function weeklyStartFor(dateISO: string): string {
  return toISODate(mondayOf(fromISODate(dateISO)))
}
