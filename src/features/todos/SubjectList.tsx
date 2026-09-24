import { useState, type ReactNode } from 'react'
import { db, type Lesson, type Todo } from '@/db/db'
import { cn } from '@/lib/cn'
import { formatShort, fromISODate } from '@/lib/date'
import { timeToMinutes } from '@/lib/time'
import { coverOn, coverPatch } from '@/features/timetable/cover'
import { KIND_ORDER } from '@/features/timetable/layout'
import { ClassRow } from './ClassRow'
import { WeeklyRow } from './WeeklyRow'
import { weekDone, weeklyTogglePatch } from './weekly'
import { isOverdue } from './today'
import { subjectStatus, type SubjectGroup } from './subjects'

/**
 * The Today tab's per-subject list: one collapsible header per subject
 * merging its class occurrence(s) (today's classes, plus any earlier
 * lecture/lab nobody covered yet — see `lessonOccurrences`) with its
 * subject-tagged todos, so a subject's whole load stacks under one row
 * instead of spamming the tab with a line per item. Collapsed by default;
 * the header's status dot still shows whether anything inside needs
 * attention. A tracked seminar never lingers here once its day has passed —
 * see `pendingSeminarAbsences`, which settles it into a recorded absence
 * instead.
 *
 * The enclosing section and heading live in `TodosScreen`, shared with
 * `SubjectDayList` — this only renders the list itself.
 */
export function SubjectList({
  groups,
  today,
  onToggleTodo,
  onEditTodo,
}: {
  groups: SubjectGroup[]
  today: string
  onToggleTodo: (t: Todo) => void
  onEditTodo: (t: Todo) => void
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggleExpanded(subject: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(subject)) next.delete(subject)
      else next.add(subject)
      return next
    })
  }

  async function toggleCover(lesson: Lesson, date: string, covered: boolean) {
    await db.lessons.update(lesson.id, coverPatch(lesson, date, covered))
  }

  async function toggleWeek(todo: Todo, monday: string, done: boolean) {
    await db.todos.update(todo.id, weeklyTogglePatch(todo, monday, done, today))
  }

  return (
    <ul className="rounded-md border border-line-soft">
      {groups.map((group) => {
        const open = expanded.has(group.subject)
        const status = subjectStatus(group, today)
        const openCount =
          group.occurrences.filter((o) => !coverOn(o.lesson, o.date)).length +
          group.weekly.filter((o) => !weekDone(o.todo, o.date)).length +
          group.todos.filter((t) => !t.done).length

        // Classes and weekly tasks are the same kind of obligation, so they
        // share one chronological stream — a subject reads `#L1 #W1 #L2 #W2`
        // rather than as two unrelated blocks. A class sorts before a weekly
        // task inside a week, since it is pinned to an actual hour.
        const occurrences: OccurrenceItem[] = [
          ...group.occurrences.map((o) => ({
            key: `${o.lesson.id}|${o.date}`,
            date: o.date,
            done: coverOn(o.lesson, o.date),
            rank: 0,
            tie: timeToMinutes(o.lesson.start) + KIND_ORDER[o.lesson.kind] / 10,
            node: (
              <ClassRow
                lesson={o.lesson}
                date={o.date}
                today={today}
                onToggle={() => void toggleCover(o.lesson, o.date, !coverOn(o.lesson, o.date))}
              />
            ),
          })),
          ...group.weekly.map((o) => ({
            key: `${o.todo.id}|${o.date}`,
            date: o.date,
            done: weekDone(o.todo, o.date),
            rank: 1,
            tie: 0,
            node: (
              <WeeklyRow
                todo={o.todo}
                date={o.date}
                today={today}
                onToggle={() => void toggleWeek(o.todo, o.date, !weekDone(o.todo, o.date))}
                onOpen={() => onEditTodo(o.todo)}
              />
            ),
          })),
        ].sort((a, b) => {
          if (a.done !== b.done) return a.done ? 1 : -1
          if (a.date !== b.date) return a.date < b.date ? -1 : 1
          if (a.rank !== b.rank) return a.rank - b.rank
          return a.tie - b.tie
        })
        const todos = [...group.todos].sort((a, b) => {
          if (a.done !== b.done) return a.done ? 1 : -1
          if (a.done) return (b.doneAt ?? 0) - (a.doneAt ?? 0)
          return (a.dueBy ?? '').localeCompare(b.dueBy ?? '')
        })

        return (
          <li key={group.subject} className="border-b border-line-soft last:border-b-0">
            <button
              type="button"
              onClick={() => toggleExpanded(group.subject)}
              className="flex w-full items-center gap-2 px-2 py-2.5 text-left text-sm"
            >
              <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', STATUS_DOT[status])} />
              <span className="min-w-0 flex-1 truncate text-parchment">{group.subject}</span>
              <span className="shrink-0 font-mono text-[11px] text-muted">
                {openCount === 0 ? 'all done' : `${openCount} open`}
              </span>
              <span className="shrink-0 text-xs text-dim">{open ? '▾' : '▸'}</span>
            </button>

            {open && (
              <ul className="pb-1.5 pl-3">
                {occurrences.map((o) => (
                  <li key={o.key}>{o.node}</li>
                ))}
                {todos.map((t) => {
                  const overdue = isOverdue(t, today)
                  return (
                    <li key={t.id} className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onToggleTodo(t)}
                        aria-label={t.done ? 'Mark as not done' : 'Mark as done'}
                        className="flex h-9 w-8 shrink-0 items-center justify-center"
                      >
                        <span
                          className={cn(
                            'flex h-5 w-5 items-center justify-center rounded border-[1.5px] text-xs',
                            t.done ? 'border-done bg-done-dim text-parchment' : 'border-brass-dim',
                          )}
                        >
                          {t.done && '✓'}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditTodo(t)}
                        className="min-w-0 flex-1 py-1.5 pr-2 text-left text-sm"
                      >
                        <span
                          className={cn(
                            'block truncate',
                            t.done ? 'text-dim line-through' : 'text-parchment',
                          )}
                        >
                          {t.title}
                        </span>
                        {t.dueBy && (
                          <span
                            className={cn(
                              'block text-xs',
                              overdue ? 'text-missed' : 'text-brass-dim',
                            )}
                          >
                            {t.repeatWeekday !== undefined && '↻ '}
                            {overdue ? 'overdue since ' : 'due '}
                            {formatShort(fromISODate(t.dueBy))}
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}

const STATUS_DOT: Record<'urgent' | 'open' | 'quiet', string> = {
  urgent: 'bg-missed',
  open: 'bg-brass-dim',
  quiet: 'bg-line',
}

/** One row in the merged classes + weekly-tasks stream. */
interface OccurrenceItem {
  key: string
  date: string
  done: boolean
  /** classes before weekly tasks within the same week */
  rank: number
  /** start time for a class, so a day reads in order */
  tie: number
  node: ReactNode
}
