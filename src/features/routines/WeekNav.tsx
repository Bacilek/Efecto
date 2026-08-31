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
        className="rounded-md border border-line px-2.5 py-1 font-mono text-xs text-muted hover:border-muted"
        aria-label="Předchozí týden"
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
        {!week.isCurrent && <span className="ml-2 text-brass">dnes</span>}
      </button>

      <button
        type="button"
        onClick={week.next}
        className="rounded-md border border-line px-2.5 py-1 font-mono text-xs text-muted hover:border-muted"
        aria-label="Další týden"
      >
        ›
      </button>
    </div>
  )
}
