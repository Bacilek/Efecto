import type { Todo } from '@/db/db'
import { addDays, fromISODate, toISODate, weekdayIndex, type WeekdayIndex } from '@/lib/date'

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
