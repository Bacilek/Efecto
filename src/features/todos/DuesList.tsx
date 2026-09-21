import type { Todo, TodoFolder } from '@/db/db'
import { cn } from '@/lib/cn'
import { formatShort, fromISODate } from '@/lib/date'
import { isOverdue } from './today'

/**
 * Todos with a deadline, at the top of the Today tab like `ClassList` — a due
 * todo shows here from the moment its deadline is set, all the way through
 * the day it's due and past it as overdue, rather than waiting for a
 * particular day the way a planned one does. It never doubles up with the
 * folder-grouped list below: `sortToday` leaves any todo with a `dueBy` out
 * of that one.
 */
export function DuesList({
  todos,
  today,
  folderOf,
  onToggle,
  onEdit,
}: {
  todos: Todo[]
  today: string
  folderOf: Map<string, TodoFolder | null>
  onToggle: (t: Todo) => void
  onEdit: (t: Todo) => void
}) {
  return (
    <section className="px-4 pb-2">
      <h2 className="pb-1 text-[11px] uppercase tracking-wider text-muted">Dues</h2>
      <ul className="rounded-md border border-line-soft">
        {todos.map((t) => {
          const folder = folderOf.get(t.id)
          const overdue = isOverdue(t, today)
          return (
            <li key={t.id} className="border-b border-line-soft last:border-b-0">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onToggle(t)}
                  aria-label={t.done ? 'Mark as not done' : 'Mark as done'}
                  className="flex h-10 w-9 shrink-0 items-center justify-center"
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
                  onClick={() => onEdit(t)}
                  className="min-w-0 flex-1 py-2 pr-2 text-left text-sm"
                >
                  <span
                    className={cn(
                      'block truncate',
                      t.done ? 'text-dim line-through' : 'text-parchment',
                    )}
                  >
                    {t.title}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xs text-muted">
                    {folder && (
                      <span>{folder.emoji ? `${folder.emoji} ${folder.name}` : folder.name}</span>
                    )}
                    <span className={overdue ? 'text-missed' : 'text-brass-dim'}>
                      {t.repeatWeekday !== undefined && '↻ '}
                      {overdue ? 'overdue since ' : 'due '}
                      {formatShort(fromISODate(t.dueBy!))}
                    </span>
                  </span>
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
