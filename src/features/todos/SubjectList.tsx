import { useState } from 'react'
import { db, type Lesson, type Todo } from '@/db/db'
import { cn } from '@/lib/cn'
import { formatShort, fromISODate } from '@/lib/date'
import { timeToMinutes } from '@/lib/time'
import { coverOn, coverPatch, isFromEarlierWeek } from '@/features/timetable/cover'
import { KIND_LABELS } from '@/features/timetable/layout'
import { semesterWeek } from '@/features/timetable/semester'
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

  return (
    <section className="px-4 pb-2">
      <h2 className="pb-1 text-[11px] uppercase tracking-wider text-muted">Classes</h2>
      <ul className="rounded-md border border-line-soft">
        {groups.map((group) => {
          const open = expanded.has(group.subject)
          const status = subjectStatus(group, today)
          const openCount =
            group.occurrences.filter((o) => !coverOn(o.lesson, o.date)).length +
            group.todos.filter((t) => !t.done).length

          const occurrences = [...group.occurrences].sort((a, b) => {
            const doneA = Number(coverOn(a.lesson, a.date))
            const doneB = Number(coverOn(b.lesson, b.date))
            if (doneA !== doneB) return doneA - doneB
            if (a.date !== b.date) return a.date < b.date ? -1 : 1
            const kindCmp = KIND_ORDER[a.lesson.kind] - KIND_ORDER[b.lesson.kind]
            if (kindCmp !== 0) return kindCmp
            return timeToMinutes(a.lesson.start) - timeToMinutes(b.lesson.start)
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
                  {occurrences.map(({ lesson: l, date }) => {
                    const cover = coverOn(l, date)
                    const week = semesterWeek(fromISODate(date))
                    const stale = !cover && isFromEarlierWeek(date, today)
                    return (
                      <li key={`${l.id}|${date}`}>
                        <button
                          type="button"
                          onClick={() => void toggleCover(l, date, !cover)}
                          className="flex w-full items-center gap-1 pr-2 text-left text-sm"
                        >
                          <span className="flex h-9 w-8 shrink-0 items-center justify-center">
                            <span
                              className={cn(
                                'flex h-5 w-5 items-center justify-center rounded border-[1.5px] text-xs',
                                cover ? 'border-done bg-done-dim text-parchment' : 'border-brass-dim',
                              )}
                            >
                              {cover && '✓'}
                            </span>
                          </span>
                          <span className="min-w-0 flex-1 py-1.5">
                            <span
                              className={cn(
                                'flex items-baseline gap-1',
                                cover ? 'text-dim line-through' : 'text-parchment',
                              )}
                            >
                              <span className={cn('shrink-0 font-mono text-xs', KIND_TEXT[l.kind])}>
                                #{KIND_LABELS[l.kind]}
                                {week ?? ''}
                              </span>
                              <span className={cn('shrink-0 text-xs', stale ? 'text-missed' : 'text-muted')}>
                                ({formatShort(fromISODate(date))})
                              </span>
                            </span>
                            {l.absentDates?.includes(date) && (
                              <span className="mt-0.5 block text-xs text-missed">marked absent</span>
                            )}
                          </span>
                        </button>
                      </li>
                    )
                  })}
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
    </section>
  )
}

const STATUS_DOT: Record<'urgent' | 'open' | 'quiet', string> = {
  urgent: 'bg-missed',
  open: 'bg-brass-dim',
  quiet: 'bg-line',
}

const KIND_TEXT: Record<Lesson['kind'], string> = {
  lecture: 'text-lecture',
  seminar: 'text-seminar',
  lab: 'text-lab',
}

/** Lectures before seminars before labs, once the date already agrees. */
const KIND_ORDER: Record<Lesson['kind'], number> = {
  lecture: 0,
  seminar: 1,
  lab: 2,
}
