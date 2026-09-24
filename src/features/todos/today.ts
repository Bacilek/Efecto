import type { Todo } from '@/db/db'
import { addDays, fromISODate, toISODate, weekdayIndex, type WeekdayIndex } from '@/lib/date'
import { isWeekly, weeklyRolloverPatch } from './weekly'

/**
 * Is the todo on the **Today** tab?
 *
 * `plannedFor` is a plan, not a deadline, so an older date still counts — an
 * unfinished task carries over rather than silently dropping back into its
 * folder overnight. A task ticked on an earlier day does not: it is finished,
 * and today's list is about what is still ahead.
 */
export function isOnToday(todo: Todo, todayISO: string): boolean {
  if (!todo.plannedFor || todo.plannedFor > todayISO) return false
  if (!todo.done) return true
  return todo.doneAt !== undefined && toISODate(new Date(todo.doneAt)) === todayISO
}

/** A planned task from an earlier day that is still open. */
export function isCarriedOver(todo: Todo, todayISO: string): boolean {
  return !todo.done && !!todo.plannedFor && todo.plannedFor < todayISO
}

/**
 * Planned, but for a day that hasn't come yet — pushed ahead with "→", so it
 * waits in its folder instead of sitting on Today.
 */
export function isPlannedAhead(todo: Todo, todayISO: string): boolean {
  return !!todo.plannedFor && todo.plannedFor > todayISO
}

/** The day after `todayISO`, as `YYYY-MM-DD`. */
export function nextDay(todayISO: string): string {
  return toISODate(addDays(fromISODate(todayISO), 1))
}

/**
 * The `plannedFor` / `plannedSince` pair for a change of plan.
 *
 * `plannedSince` marks the start of an uninterrupted run on Today: a task that
 * is already planned keeps the day it started, however often it is pushed
 * ahead, and one that isn't starts a new run. Taking it off Today ends the run
 * and clears both.
 */
export function planPatch(
  prev: Todo | null,
  plannedFor: string | null,
): Pick<Todo, 'plannedFor' | 'plannedSince'> {
  if (!plannedFor) return { plannedFor: undefined, plannedSince: undefined }
  return { plannedFor, plannedSince: prev?.plannedFor ? plannedSinceOf(prev) : plannedFor }
}

/** The day the task's current run on Today began. */
export function plannedSinceOf(todo: Todo): string | undefined {
  return todo.plannedSince ?? todo.plannedFor
}

/**
 * Is the todo in the Today tab's **Dues** group? Unlike `isOnToday`, a due
 * task shows from the moment its deadline is set — there is nothing to wait
 * for — all the way through the deadline and past it as overdue, until it's
 * ticked. A ticked one still shows on the day it was ticked, same as a
 * planned todo, then drops off the day after.
 */
export function isDue(todo: Todo, todayISO: string): boolean {
  if (!todo.dueBy) return false
  if (!todo.done) return true
  return todo.doneAt !== undefined && toISODate(new Date(todo.doneAt)) === todayISO
}

/** A due task whose deadline has passed and is still open. */
export function isOverdue(todo: Todo, todayISO: string): boolean {
  return !todo.done && !!todo.dueBy && todo.dueBy < todayISO
}

/**
 * A day's status for something on a `SubjectDayList`-style day report.
 * `pending` is a lesson occurrence with nothing to lose by not being covered
 * yet (a lecture, or any lesson without tracked attendance) — as opposed to
 * `missed`, which is reserved for an actual recorded absence.
 */
export type DayStatus = 'done' | 'missed' | 'upcoming' | 'pending'

/**
 * A plain (non-subject) todo's status on a specific day, given it has been
 * planned at some point — the day-report counterpart to `isOnToday`, for
 * `SubjectDayNav`'s pager. Unlike a recurring subject todo, a plain todo
 * normally runs through its life once (create → plan → maybe re-plan →
 * done), so `plannedSinceOf` — which survives an explicit re-plan within the
 * same run — is enough to answer "was this open on day X" without any extra
 * history: the run spans `[plannedSinceOf(todo), doneAt ?? todayISO]`.
 */
export function plannedTodoStatus(todo: Todo, dateISO: string, todayISO: string): DayStatus | null {
  if (!todo.plannedFor) return null
  if (todo.plannedFor > todayISO) {
    return dateISO === todo.plannedFor ? 'upcoming' : null
  }
  const start = plannedSinceOf(todo)
  if (!start || dateISO < start) return null
  const end = todo.done && todo.doneAt !== undefined ? toISODate(new Date(todo.doneAt)) : todayISO
  if (dateISO > end) return null
  return todo.done && dateISO === end ? 'done' : 'missed'
}

/** The next date on or after `todayISO` that lands on `weekday`. */
export function nextOccurrenceISO(weekday: WeekdayIndex, todayISO: string): string {
  const today = fromISODate(todayISO)
  const diff = (weekday - weekdayIndex(today) + 7) % 7
  return toISODate(addDays(today, diff))
}

/**
 * Re-arms a recurring due todo for its next cycle once the one just ticked
 * has fully passed. Deliberately only fires on a *ticked* todo whose due day
 * is behind — an unticked (overdue) one stays "overdue since ..." exactly
 * like a one-off Dues todo until the user ticks it, rather than silently
 * rolling a missed week out from under them.
 */
export function dueRolloverPatch(todo: Todo, todayISO: string): Partial<Todo> | null {
  // Belt and braces: the editor can't write both flavours, but a row that
  // somehow carried both must not have its weeks read as due dates.
  if (isWeekly(todo)) return null
  if (todo.repeatWeekday === undefined || !todo.done || !todo.dueBy || todo.dueBy >= todayISO) {
    return null
  }
  return {
    dueBy: nextOccurrenceISO(todo.repeatWeekday, todayISO),
    done: false,
    doneAt: undefined,
    // The cycle that's rolling over would otherwise be lost — `dueBy` is
    // about to move past it, and nothing else remembers it was done.
    completedDates: [...(todo.completedDates ?? []), todo.dueBy],
  }
}

/**
 * Re-arms whichever recurring flavour this todo is, so the screen's rollover
 * effect stays one call rather than growing a branch per flavour.
 */
export function todoRolloverPatch(todo: Todo, todayISO: string): Partial<Todo> | null {
  return weeklyRolloverPatch(todo, todayISO) ?? dueRolloverPatch(todo, todayISO)
}
