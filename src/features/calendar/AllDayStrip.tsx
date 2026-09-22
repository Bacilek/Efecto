import type { Todo } from '@/db/db'
import { cn } from '@/lib/cn'
import { DAY_LABELS, formatShort, toISODate, weekdayIndex } from '@/lib/date'
import { DAYS, GUTTER, ROW_HEIGHT, isTimed } from './layout'

/**
 * All-day todos and ordinary dated-but-untimed ones, in a strip above the
 * timed grid rather than stretched into it — so nothing dated is ever
 * invisible. Shares the grid's gutter width and day-label rendering so the
 * two blocks read as one continuous grid, gutter aligned top to bottom.
 */
export function AllDayStrip({
  todos,
  dates,
  showToday,
  onTapTodo,
}: {
  todos: Todo[]
  /** that week's Mon–Sun */
  dates: Date[]
  /** whether the week on screen is the one we're in — highlights today's label */
  showToday: boolean
  onTapTodo: (todo: Todo) => void
}) {
  const now = new Date()

  return (
    <div className="flex px-4 pb-1">
      <div className="shrink-0" style={{ width: GUTTER, paddingRight: 6 }}>
        {DAYS.map((d, i) => (
          <div
            key={d}
            className="flex flex-col items-center justify-center leading-tight"
            style={{ minHeight: ROW_HEIGHT / 2 }}
          >
            <span
              className={cn(
                'text-[11px]',
                showToday && weekdayIndex(now) === d ? 'text-brass' : 'text-muted',
              )}
            >
              {DAY_LABELS[d]}
            </span>
            {dates[i] && (
              <span className="font-mono text-[9px] text-dim">{formatShort(dates[i])}</span>
            )}
          </div>
        ))}
      </div>

      <div className="min-w-0 flex-1">
        {DAYS.map((d, i) => {
          const dateISO = toISODate(dates[i])
          const dayTodos = todos.filter((t) => t.plannedFor === dateISO && !isTimed(t))
          return (
            <div
              key={d}
              className="flex flex-wrap items-center gap-1 py-0.5"
              style={{ minHeight: ROW_HEIGHT / 2 }}
            >
              {dayTodos.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onTapTodo(t)}
                  className={cn(
                    'max-w-full truncate rounded border px-1.5 py-0.5 text-[11px]',
                    t.allDay
                      ? 'border-brass-dim bg-brass-dim/30 text-parchment'
                      : 'border-line text-dim',
                  )}
                >
                  {t.title}
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
