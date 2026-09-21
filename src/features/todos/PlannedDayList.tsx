import type { Todo, TodoFolder } from '@/db/db'
import type { DayStatus } from './today'
import { DayRow } from './SubjectDayList'

/**
 * A flat day report for plain (non-subject) planned todos, shown alongside
 * `SubjectDayList` when paging to a day other than today. No collapsible
 * grouping — unlike a subject's classes, a day's planned todos are usually
 * few, and they already span every folder rather than belonging to one.
 */
export function PlannedDayList({
  items,
  folderOf,
  onToggle,
}: {
  items: { todo: Todo; status: DayStatus }[]
  folderOf: Map<string, TodoFolder | null>
  onToggle: (todo: Todo, done: boolean) => void
}) {
  if (items.length === 0) return null

  const sorted = [...items].sort((a, b) => a.todo.title.localeCompare(b.todo.title))

  return (
    <ul className="rounded-md border border-line-soft">
      {sorted.map(({ todo, status }) => {
        const folder = folderOf.get(todo.id)
        return (
          <DayRow
            key={todo.id}
            status={status}
            onToggle={status === 'upcoming' ? undefined : () => onToggle(todo, status !== 'done')}
          >
            <span className="min-w-0 flex-1 truncate">{todo.title}</span>
            {folder && (
              <span className="shrink-0 text-xs text-muted">
                {folder.emoji ? `${folder.emoji} ${folder.name}` : folder.name}
              </span>
            )}
          </DayRow>
        )
      })}
    </ul>
  )
}
