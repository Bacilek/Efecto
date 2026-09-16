import type { Todo } from '@/db/db'
import { addDays, fromISODate, toISODate } from '@/lib/date'

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
