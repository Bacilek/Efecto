import { formatShort } from '@/lib/date'
import type { CalendarWeekState } from './useCalendarWeek'

/** Same shape as routines' `WeekNav`, minus the year clamp and the week-number
 *  banner — a calendar week has no odd/even-parity concept to show. */
export function CalendarWeekNav({ week }: { week: CalendarWeekState }) {
  const from = week.dates[0]
  const to = week.dates[6]
  return (
    <div className="flex items-center justify-between px-4 pb-2">
      <button type="button" onClick={week.prev} className={arrow} aria-label="Previous week">
        ‹
      </button>

      <button
        type="button"
        onClick={week.reset}
        disabled={week.isCurrent}
        className="flex flex-col items-center gap-0.5 font-mono text-xs text-muted disabled:opacity-60"
      >
        <span>
          {formatShort(from)} – {formatShort(to)}
          {!week.isCurrent && <span className="ml-2 text-brass">today</span>}
        </span>
      </button>

      <button type="button" onClick={week.next} className={arrow} aria-label="Next week">
        ›
      </button>
    </div>
  )
}

const arrow =
  'rounded-md border border-line px-2.5 py-1 font-mono text-xs text-muted transition-colors enabled:hover:border-muted disabled:opacity-30'
