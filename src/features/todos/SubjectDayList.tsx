import type { ReactNode } from 'react'
import { useState } from 'react'
import type { Lesson, Todo } from '@/db/db'
import { cn } from '@/lib/cn'
import { timeToMinutes } from '@/lib/time'
import { KIND_LABELS, KIND_ORDER, KIND_TEXT } from '@/features/timetable/layout'
import type { DayStatus, SubjectDayGroup } from './subjectDay'

/**
 * A checklist report for one day, paged to by `SubjectDayNav` — same
 * collapsible per-subject shape as the live `SubjectList`, but a fixed-day
 * snapshot rather than a worklist: no carry-over, no urgency ranking, just
 * done/missed for a past day and a read-only preview for a future one.
 */
export function SubjectDayList({
  groups,
  onToggleOccurrence,
  onToggleTodo,
}: {
  groups: SubjectDayGroup[]
  onToggleOccurrence: (lesson: Lesson, covered: boolean) => void
  onToggleTodo: (todo: Todo, done: boolean) => void
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

  if (groups.length === 0) {
    return (
      <p className="rounded-md border border-line-soft px-3 py-4 text-center text-xs text-dim">
        Nothing scheduled.
      </p>
    )
  }

  return (
    <ul className="rounded-md border border-line-soft">
      {groups.map((group) => {
        const open = expanded.has(group.subject)
        const status = groupStatus(group)
        const count = group.occurrences.length + group.todos.length

        const occurrences = [...group.occurrences].sort((a, b) => {
          const kindCmp = KIND_ORDER[a.lesson.kind] - KIND_ORDER[b.lesson.kind]
          return kindCmp !== 0 ? kindCmp : timeToMinutes(a.lesson.start) - timeToMinutes(b.lesson.start)
        })
        const todos = [...group.todos].sort((a, b) => a.todo.title.localeCompare(b.todo.title))

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
                {count} {count === 1 ? 'item' : 'items'}
              </span>
              <span className="shrink-0 text-xs text-dim">{open ? '▾' : '▸'}</span>
            </button>

            {open && (
              <ul className="pb-1.5 pl-3">
                {occurrences.map(({ lesson: l, date, status: s }) => (
                  <DayRow
                    key={`${l.id}|${date}`}
                    status={s}
                    onToggle={s === 'upcoming' ? undefined : () => onToggleOccurrence(l, s !== 'done')}
                  >
                    <span className={cn('font-mono text-xs', KIND_TEXT[l.kind])}>#{KIND_LABELS[l.kind]}</span>
                    {l.absentDates?.includes(date) && (
                      <span className="text-xs text-missed">marked absent</span>
                    )}
                  </DayRow>
                ))}
                {todos.map(({ todo, status: s }) => (
                  <DayRow
                    key={todo.id}
                    status={s}
                    onToggle={s === 'upcoming' ? undefined : () => onToggleTodo(todo, s !== 'done')}
                  >
                    <span className="truncate text-sm">{todo.title}</span>
                  </DayRow>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * One occurrence or todo row: tappable to toggle past-day status, plain for
 * an upcoming one. Exported so `PlannedDayList` (a flat, non-subject list of
 * the same day-report shape) can share the exact same row look.
 */
export function DayRow({
  status,
  onToggle,
  children,
}: {
  status: DayStatus
  /** unset for an upcoming (future) row — nothing to toggle yet */
  onToggle?: () => void
  children: ReactNode
}) {
  const mark = (
    <span
      className={cn(
        'flex h-5 w-5 items-center justify-center rounded border-[1.5px] text-xs',
        status === 'done' && 'border-done bg-done-dim text-parchment',
        status === 'missed' && 'border-missed-dim text-missed',
        (status === 'upcoming' || status === 'pending') && 'border-line text-dim',
      )}
    >
      {status === 'done' ? '✓' : status === 'missed' ? '✕' : ''}
    </span>
  )
  const textClass =
    status === 'done' ? 'text-dim line-through' : status === 'missed' ? 'text-missed' : 'text-dim'

  if (!onToggle) {
    return (
      <li className="flex items-center gap-1 py-1.5 pr-2 text-sm">
        <span className="flex h-9 w-8 shrink-0 items-center justify-center">{mark}</span>
        <span className={cn('flex min-w-0 flex-1 items-center gap-1.5', textClass)}>{children}</span>
      </li>
    )
  }

  return (
    <li>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-1 py-1.5 pr-2 text-left text-sm">
        <span className="flex h-9 w-8 shrink-0 items-center justify-center">{mark}</span>
        <span className={cn('flex min-w-0 flex-1 items-center gap-1.5', textClass)}>{children}</span>
      </button>
    </li>
  )
}

/**
 * A group's dot: red if anything in it was actually missed, green once
 * everything is done, grey otherwise — covering both a future preview and a
 * still-`pending` lecture, neither of which is anything gone wrong.
 */
function groupStatus(group: SubjectDayGroup): 'missed' | 'done' | 'upcoming' {
  const statuses = [...group.occurrences.map((o) => o.status), ...group.todos.map((t) => t.status)]
  if (statuses.some((s) => s === 'missed')) return 'missed'
  if (statuses.some((s) => s === 'upcoming' || s === 'pending')) return 'upcoming'
  return 'done'
}

const STATUS_DOT: Record<'missed' | 'done' | 'upcoming', string> = {
  missed: 'bg-missed',
  done: 'bg-done',
  upcoming: 'bg-line',
}
