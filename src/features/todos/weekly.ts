import type { Todo } from '@/db/db'
import { addDays, fromISODate, toISODate, weekdayIndex, type WeekdayIndex } from '@/lib/date'
import {
  semesterWeek,
  semesterWeekCount,
  semesterWeekMonday,
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

/** The weekday a cycle closes on, from any of its dates. */
export function weekdayOf(sinceISO: string): WeekdayIndex {
  return weekdayIndex(fromISODate(sinceISO))
}

/** The weekday a weekly todo's cycles close on, taken from its own start. */
export function weeklyWeekday(todo: Todo): WeekdayIndex {
  return weekdayOf(todo.weeklySince!)
}

/**
 * A cycle **is** a semester week, and the chosen weekday only says when
 * inside it the work is up. That is the whole reason the numbering can be
 * trusted: a cycle's number is just the semester week it is, so it lines up
 * with the classes (`#L2`) by construction.
 *
 * Letting cycles float as free 7-day spans instead — each keyed to its own
 * closing date — made the number a question with no good answer, because a
 * span from Friday to Thursday belongs to two semester weeks at once and
 * whichever end you counted from was wrong for some other closing weekday.
 */
export function cycleDate(week: number, weekday: WeekdayIndex): string {
  return toISODate(addDays(semesterWeekMonday(week), weekday))
}

/** Which semester week a cycle is — its number, and the badge. */
export function cycleWeek(closingISO: string): number | null {
  return semesterWeek(fromISODate(closingISO))
}

/** The semester week we're in, clamped into the term at either end. */
function weekNow(todayISO: string): number {
  const week = semesterWeek(fromISODate(todayISO))
  if (week !== null) return week
  return todayISO < cycleDate(1, 0) ? 1 : semesterWeekCount()
}

/**
 * The cycle a weekly todo is currently inside — this semester week's. It stays
 * current for the whole week, so a closing day that has already gone by shows
 * as outstanding-and-late rather than being skipped for next week's.
 */
export function currentAnchor(todo: Todo, todayISO: string): string {
  return cycleDate(weekNow(todayISO), weeklyWeekday(todo))
}

/** A cycle whose closing day has passed — what turns its date red. */
export function weeklyStale(dateISO: string, todayISO: string): boolean {
  return dateISO < todayISO
}

/**
 * Every cycle a weekly todo is still owed for, oldest first — this semester
 * week's, plus every earlier week nobody ticked, the way `lessonOccurrences`
 * accumulates uncovered classes. A cycle ticked just now still shows, struck
 * through, so a mistaken tap has something to undo.
 *
 * Walking semester weeks rather than counting days forward is also what keeps
 * a term change harmless: weeks outside the semester simply don't exist, so
 * a todo surviving into the next term restarts at its week 1 with last term's
 * `completedDates` sitting inert, keyed to dates no cycle ever asks for.
 */
export function weeklyOccurrences(todos: Todo[], todayISO: string): WeeklyOccurrence[] {
  const now = weekNow(todayISO)

  const result: WeeklyOccurrence[] = []
  for (const todo of todos) {
    if (!isWeekly(todo)) continue
    const weekday = weeklyWeekday(todo)
    const from = cycleWeek(todo.weeklySince!) ?? 1
    for (let w = Math.max(from, 1); w <= now; w++) {
      const iso = cycleDate(w, weekday)
      if (w === now || !weekDone(todo, iso) || justTicked(todo, iso, todayISO)) {
        result.push({ todo, date: iso, week: w })
      }
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

/** This semester week's cycle for `weekday` — where a new weekly task starts. */
export function weeklyStartFor(weekday: WeekdayIndex, todayISO: string): string {
  return cycleDate(weekNow(todayISO), weekday)
}

/** Move a start to a different closing weekday, keeping its semester week. */
export function withWeekday(sinceISO: string, weekday: WeekdayIndex): string {
  return cycleDate(cycleWeek(sinceISO) ?? 1, weekday)
}
