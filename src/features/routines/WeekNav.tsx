import { formatShort, isoWeek, weekParity } from '@/lib/date'
import type { WeekState } from './useWeek'

export function WeekNav({ week }: { week: WeekState }) {
  const from = week.dates[0]
  const to = week.dates[6]
  const no = isoWeek(week.monday)
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
        className="flex flex-col items-center gap-0.5 font-mono text-xs text-muted disabled:opacity-60"
      >
        <span>
          {formatShort(from)} – {formatShort(to)}
          {!week.isCurrent && <span className="ml-2 text-brass">today</span>}
        </span>
        <span className="text-[10px] text-dim">
          Week {no} · {weekParity(no)}
        </span>
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
