import type { Todo } from '@/db/db'
import { toISODate } from '@/lib/date'

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
