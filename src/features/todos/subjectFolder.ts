import type { Lesson, Todo } from '@/db/db'
import { coverOn, isFromEarlierWeek, type LessonOccurrence } from '@/features/timetable/cover'
import { isOverdue } from './today'
import { isWeekly, weekDone, type WeeklyOccurrence } from './weekly'

export interface SubjectFolder {
  subject: string
  occurrences: LessonOccurrence[]
  /** outstanding cycles — what the counts and the urgency dot are about */
  weekly: WeeklyOccurrence[]
  /** the weekly tasks themselves, one row each: what exists for this subject */
  weeklyTodos: Todo[]
  todos: Todo[]
}

/**
 * Everything belonging to one subject, for the browsable subject view: its
 * outstanding class occurrences and *all* of its tagged todos.
 *
 * "All" is the difference from `buildSubjectGroups`, which powers the Today
 * tab: that one deliberately shows only what is `isOnToday` or `isDue`,
 * because Today answers "what now". A subject folder answers "what does this
 * subject involve this semester", so a weekly task due next Thursday and one
 * already ticked both belong — otherwise the folder couldn't be used to edit
 * them, which is the point of it being visitable at all.
 */
export function buildSubjectFolders(
  lessons: Lesson[],
  occurrences: LessonOccurrence[],
  weekly: WeeklyOccurrence[],
  todos: Todo[],
): SubjectFolder[] {
  const names = new Set<string>()
  for (const l of lessons) names.add(l.name)
  for (const t of todos) if (t.subject) names.add(t.subject)

  return [...names]
    .sort((a, b) => a.localeCompare(b))
    .map((subject) => ({
      subject,
      occurrences: occurrences.filter((o) => o.lesson.name === subject),
      weekly: weekly.filter((o) => o.todo.subject === subject),
      // One row per weekly task, not per outstanding cycle: the folder is the
      // standing list of what this subject involves, so it answers "what is
      // there" — the numbered cycles are the actual work and belong on Today.
      weeklyTodos: todos
        .filter((t) => t.subject === subject && isWeekly(t))
        .sort((a, b) => a.title.localeCompare(b.title)),
      // ...and therefore kept out of the plain task list, so neither shape
      // shows twice.
      todos: sortSubjectTodos(todos.filter((t) => t.subject === subject && !isWeekly(t))),
    }))
}

/**
 * Open tasks first, soonest deadline at the top, then the ticked ones sunk to
 * the bottom by most recent tick — the same shape as a folder's own list, so
 * finishing something never makes it vanish but it stops competing for
 * attention. A recurring todo is only ever open or ticked *for its current
 * cycle*, so it sorts by that cycle's `dueBy` like any other.
 */
export function sortSubjectTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    if (a.done) return (b.doneAt ?? 0) - (a.doneAt ?? 0)
    if (a.dueBy !== b.dueBy) {
      if (!a.dueBy) return 1
      if (!b.dueBy) return -1
      return a.dueBy < b.dueBy ? -1 : 1
    }
    return a.title.localeCompare(b.title)
  })
}

/** How many of a subject's items still want doing — the tile's subtitle. */
export function openCountOf(folder: SubjectFolder): number {
  return (
    folder.todos.filter((t) => !t.done).length +
    folder.occurrences.filter((o) => !coverOn(o.lesson, o.date)).length +
    folder.weekly.filter((o) => !weekDone(o.todo, o.date)).length
  )
}

/** Something overdue or carried over — the tile's red dot. */
export function isUrgent(folder: SubjectFolder, todayISO: string): boolean {
  return (
    folder.todos.some((t) => isOverdue(t, todayISO)) ||
    folder.occurrences.some(
      (o) => !coverOn(o.lesson, o.date) && isFromEarlierWeek(o.date, todayISO),
    ) ||
    folder.weekly.some((o) => !weekDone(o.todo, o.date) && isFromEarlierWeek(o.date, todayISO))
  )
}
