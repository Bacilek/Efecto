import type { Todo } from '@/db/db'
import { fromISODate } from '@/lib/date'
import { isFromEarlierWeek } from '@/features/timetable/cover'
import { semesterWeek } from '@/features/timetable/semester'
import { OccurrenceRow } from './OccurrenceRow'
import { weekDone } from './weekly'

/**
 * One week a weekly task is owed for — `Interaktivní Osnova #W2 (14.09)`.
 * Deliberately the same row as a class: it is the same kind of obligation,
 * owed for a week rather than by a date, and several can be outstanding at
 * once. Tapping the body edits the task itself, since the occurrence has
 * nothing of its own to change.
 */
export function WeeklyRow({
  todo,
  date,
  today,
  onToggle,
  onOpen,
}: {
  todo: Todo
  /** Monday of the week this row stands for */
  date: string
  today: string
  onToggle: () => void
  onOpen: () => void
}) {
  const done = weekDone(todo, date)
  const week = semesterWeek(fromISODate(date))

  return (
    <OccurrenceRow
      badge={<span className="shrink-0 font-mono text-xs text-brass">#W{week ?? ''}</span>}
      date={date}
      done={done}
      stale={!done && isFromEarlierWeek(date, today)}
      label={todo.title}
      onToggle={onToggle}
      onOpen={onOpen}
    />
  )
}
