import type { Entry, Routine } from '@/db/db'
import { entryId } from '@/db/db'
import { cn } from '@/lib/cn'
import { DAY_LABELS, formatShort, isSameDay, toISODate, todayISO } from '@/lib/date'
import { Cell } from './Cell'
import { dayCompletion } from './stats'
import { resolveCellState } from './status'

export function RoutineGrid({
  dates,
  routines,
  entries,
  onTapCell,
  onEditRoutine,
}: {
  dates: Date[]
  routines: Routine[]
  entries: Map<string, Entry>
  onTapCell: (routine: Routine, dateISO: string) => void
  onEditRoutine: (routine: Routine) => void
}) {
  const now = new Date()
  const today = todayISO()

  return (
    <div className="overflow-x-auto no-scrollbar">
      <table className="border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="sticky left-0 z-20 bg-ink" />
            {routines.map((r) => (
              <th key={r.id} className="bg-ink p-0">
                <button
                  type="button"
                  onClick={() => onEditRoutine(r)}
                  className="flex h-16 w-12 flex-col items-center justify-end pb-1.5"
                  title={r.name}
                  aria-label={r.name}
                >
                  {r.emoji ? (
                    <span className="text-xl leading-none">{r.emoji}</span>
                  ) : (
                    <span className="max-h-14 w-4 rotate-180 truncate text-[11px] leading-tight text-muted [writing-mode:vertical-rl]">
                      {r.name}
                    </span>
                  )}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dates.map((date, i) => {
            const isToday = isSameDay(date, now)
            const dISO = toISODate(date)
            const day = dayCompletion(routines, date, entries, today)
            return (
              <tr key={dISO}>
                <th
                  scope="row"
                  className={cn(
                    'sticky left-0 z-10 border-t border-line-soft px-3 text-left align-middle',
                    isToday ? 'bg-today' : 'bg-ink',
                  )}
                >
                  <div className="whitespace-nowrap">
                    <span
                      className={cn('text-[13px]', isToday ? 'text-brass' : 'text-parchment')}
                    >
                      {DAY_LABELS[i]}
                    </span>{' '}
                    <span className="font-mono text-[11px] text-muted">{formatShort(date)}</span>
                  </div>
                  <div className="font-mono text-[10px] text-dim">
                    {day.total ? `${day.pct} %` : '–'}
                  </div>
                </th>
                {routines.map((r) => {
                  const entry = entries.get(entryId(r.id, dISO))
                  const state = resolveCellState(r, date, entry, today)
                  return (
                    <td
                      key={r.id}
                      className={cn('border-t border-line-soft p-0', isToday && 'bg-today')}
                    >
                      <Cell state={state} onTap={() => onTapCell(r, dISO)} />
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
