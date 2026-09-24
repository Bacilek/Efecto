import type { Todo } from '@/db/db'
import { coverOn, isFromEarlierWeek, type LessonOccurrence } from '@/features/timetable/cover'
import { isDue, isOnToday, isOverdue } from './today'
import { isWeekly, weekDone, type WeeklyOccurrence } from './weekly'

export interface SubjectGroup {
  subject: string
  occurrences: LessonOccurrence[]
  /** weeks a weekly task is still owed for — the same shape as a class */
  weekly: WeeklyOccurrence[]
  todos: Todo[]
}

/**
 * Merges today's class occurrences with subject-tagged todos into one group
 * per subject, so a subject's attendance and its (recurring or one-off)
 * busywork stack under a single collapsible header instead of each being its
 * own flat row. A todo only joins when it is actually `isOnToday` or `isDue`
 * — the same rules that gate the plain folder-grouped list and `DuesList` —
 * so a subject group shows exactly what those would have shown, just grouped.
 */
export function buildSubjectGroups(
  occurrences: LessonOccurrence[],
  weekly: WeeklyOccurrence[],
  todos: Todo[],
  todayISO: string,
): SubjectGroup[] {
  const groups = new Map<string, SubjectGroup>()

  function groupFor(subject: string): SubjectGroup {
    let g = groups.get(subject)
    if (!g) {
      g = { subject, occurrences: [], weekly: [], todos: [] }
      groups.set(subject, g)
    }
    return g
  }

  for (const o of occurrences) groupFor(o.lesson.name).occurrences.push(o)
  for (const o of weekly) {
    if (o.todo.subject) groupFor(o.todo.subject).weekly.push(o)
  }
  for (const t of todos) {
    // A weekly task is represented by its occurrence rows, never by itself —
    // listing both would put the "title + due sub-line" shape right next to
    // the occurrence rows that exist to replace it.
    if (isWeekly(t)) continue
    if (t.subject && (isOnToday(t, todayISO) || isDue(t, todayISO))) {
      groupFor(t.subject).todos.push(t)
    }
  }

  return [...groups.values()].sort((a, b) => {
    const rankCmp = STATUS_RANK[subjectStatus(a, todayISO)] - STATUS_RANK[subjectStatus(b, todayISO)]
    return rankCmp !== 0 ? rankCmp : a.subject.localeCompare(b.subject)
  })
}

export type SubjectStatus = 'urgent' | 'open' | 'quiet'

const STATUS_RANK: Record<SubjectStatus, number> = { urgent: 0, open: 1, quiet: 2 }

/**
 * A collapsed group still has to surface urgency without expanding: `urgent`
 * = an overdue todo or a class carried over from an earlier week, `open` =
 * something to do today, `quiet` = nothing outstanding.
 */
export function subjectStatus(group: SubjectGroup, todayISO: string): SubjectStatus {
  const overdue =
    group.todos.some((t) => isOverdue(t, todayISO)) ||
    group.occurrences.some(
      (o) => !coverOn(o.lesson, o.date) && isFromEarlierWeek(o.date, todayISO),
    ) ||
    group.weekly.some((o) => !weekDone(o.todo, o.date) && isFromEarlierWeek(o.date, todayISO))
  if (overdue) return 'urgent'
  const open =
    group.todos.some((t) => !t.done) ||
    group.occurrences.some((o) => !coverOn(o.lesson, o.date)) ||
    group.weekly.some((o) => !weekDone(o.todo, o.date))
  return open ? 'open' : 'quiet'
}
