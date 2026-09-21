import { addDays, DAY_LABELS_LONG, formatShort, fromISODate, toISODate, todayISO, weekdayIndex } from '@/lib/date'

/**
 * Pages the Classes section one day at a time — same shape as the
 * Timetable's `SemesterNav`, just at day rather than week granularity, and
 * with no bounds: paging past the semester simply reports an empty day
 * (`lessonsOn` already returns nothing outside it), which is harmless.
 */
export function SubjectDayNav({ date, onChange }: { date: string; onChange: (iso: string) => void }) {
  const today = todayISO()
  const isToday = date === today

  function shift(days: number) {
    onChange(toISODate(addDays(fromISODate(date), days)))
  }

  return (
    <div className="flex items-center justify-between pb-2">
      <button type="button" onClick={() => shift(-1)} className={arrow} aria-label="Previous day">
        ‹
      </button>

      <button
        type="button"
        onClick={() => onChange(today)}
        disabled={isToday}
        className="flex flex-col items-center gap-0.5 font-mono text-xs text-muted disabled:opacity-60"
      >
        <span>
          {DAY_LABELS_LONG[weekdayIndex(fromISODate(date))]} · {formatShort(fromISODate(date))}
          {!isToday && <span className="ml-2 text-brass">today</span>}
        </span>
      </button>

      <button type="button" onClick={() => shift(1)} className={arrow} aria-label="Next day">
        ›
      </button>
    </div>
  )
}

const arrow =
  'rounded-md border border-line px-2.5 py-1 font-mono text-xs text-muted transition-colors enabled:hover:border-muted disabled:opacity-30'
