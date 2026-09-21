import type { Lesson, Todo } from '@/db/db'
import { fromISODate, toISODate, weekdayIndex } from '@/lib/date'
import { coverOn, lessonsOn } from '@/features/timetable/cover'

export type DayStatus = 'done' | 'missed' | 'upcoming'

function lessonStatus(lesson: Lesson, dateISO: string, todayISO: string): DayStatus {
  if (dateISO > todayISO) return 'upcoming'
  return coverOn(lesson, dateISO) ? 'done' : 'missed'
}

/**
 * Whether a *recurring* todo's cycle lands on `dateISO`, and its status —
 * null when the todo has no cycle there at all (wrong weekday, or it didn't
 * exist yet). `completedDates` covers a cycle that has already rolled past;
 * `dueBy` — which only ever advances on completion — covers the current or
 * any still-earlier unresolved one, so a date at or before it reads as
 * "missed" without needing its own log entry.
 */
function recurringTodoStatus(todo: Todo, dateISO: string, todayISO: string): DayStatus | null {
  if (todo.repeatWeekday === undefined || !todo.subject) return null
  if (weekdayIndex(fromISODate(dateISO)) !== todo.repeatWeekday) return null
  if (toISODate(new Date(todo.createdAt)) > dateISO) return null

  if (dateISO > todayISO) return 'upcoming'
  if (todo.completedDates?.includes(dateISO)) return 'done'
  if (todo.dueBy !== undefined && dateISO <= todo.dueBy) return 'missed'
  return null
}

/**
 * A one-off subject-tagged todo's `dueBy` never moves, so unlike a recurring
 * one it needs no history at all — the current `done` flag already answers
 * the question for any date its deadline happens to be.
 */
function oneOffSubjectTodoStatus(todo: Todo, dateISO: string, todayISO: string): DayStatus | null {
  if (todo.repeatWeekday !== undefined || !todo.subject || !todo.dueBy) return null
  if (todo.dueBy !== dateISO) return null
  if (dateISO > todayISO) return 'upcoming'
  return todo.done ? 'done' : 'missed'
}

export interface DayOccurrence {
  lesson: Lesson
  date: string
  status: DayStatus
}

export interface DayTodo {
  todo: Todo
  status: DayStatus
}

export interface SubjectDayGroup {
  subject: string
  occurrences: DayOccurrence[]
  todos: DayTodo[]
}

/**
 * A checklist report for one specific day — what was scheduled or due, and
 * whether it's marked done. Deliberately not a replay of what the app would
 * have shown you on that day (there's no timestamp for exactly when a tap
 * happened), just today's data read through that day's lens — the same
 * `coveredDates`/`completedDates` membership check the live Today view uses,
 * for a date of the caller's choosing instead of always today.
 */
export function buildSubjectDayGroups(
  lessons: Lesson[],
  todos: Todo[],
  dateISO: string,
  todayISO: string,
): SubjectDayGroup[] {
  const groups = new Map<string, SubjectDayGroup>()

  function groupFor(subject: string): SubjectDayGroup {
    let g = groups.get(subject)
    if (!g) {
      g = { subject, occurrences: [], todos: [] }
      groups.set(subject, g)
    }
    return g
  }

  for (const lesson of lessonsOn(lessons, dateISO)) {
    groupFor(lesson.name).occurrences.push({
      lesson,
      date: dateISO,
      status: lessonStatus(lesson, dateISO, todayISO),
    })
  }
  for (const todo of todos) {
    if (!todo.subject) continue
    const status = recurringTodoStatus(todo, dateISO, todayISO) ?? oneOffSubjectTodoStatus(todo, dateISO, todayISO)
    if (status) groupFor(todo.subject).todos.push({ todo, status })
  }

  return [...groups.values()].sort((a, b) => a.subject.localeCompare(b.subject))
}
