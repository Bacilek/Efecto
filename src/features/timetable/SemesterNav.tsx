import { formatShort, weekParity } from '@/lib/date'
import type { SemesterWeekState } from './useSemesterWeek'

export function SemesterNav({ week }: { week: SemesterWeekState }) {
  const outsideSemester = week.currentWeek === null

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
        disabled={week.isCurrent || outsideSemester}
        className="flex flex-col items-center gap-0.5 font-mono text-xs text-muted disabled:opacity-60"
      >
        <span>
          Semester week {week.week} · {weekParity(week.week)}
          {!week.isCurrent && !outsideSemester && <span className="ml-2 text-brass">now</span>}
        </span>
        <span className="text-[10px] text-dim">
          {formatShort(week.dates[0])} – {formatShort(week.dates[4])}
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
