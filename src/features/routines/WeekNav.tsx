import { formatShort } from '@/lib/date'
import type { WeekState } from './useWeek'

export function WeekNav({ week }: { week: WeekState }) {
  const from = week.dates[0]
  const to = week.dates[6]
  return (
    <div className="flex items-center justify-between px-4 pb-2">
      <button
        type="button"
        onClick={week.prev}
        disabled={!week.canPrev}
        className={arrow}
        aria-label="Previous week"
      >
        ‹
      </button>

      <button
        type="button"
        onClick={week.reset}
        disabled={week.isCurrent}
        className="font-mono text-xs text-muted disabled:opacity-60"
      >
        {formatShort(from)} – {formatShort(to)}
        {!week.isCurrent && <span className="ml-2 text-brass">today</span>}
      </button>

      <button
        type="button"
        onClick={week.next}
        disabled={!week.canNext}
        className={arrow}
        aria-label="Next week"
      >
        ›
      </button>
    </div>
  )
}

const arrow =
  'rounded-md border border-line px-2.5 py-1 font-mono text-xs text-muted transition-colors enabled:hover:border-muted disabled:opacity-30'
