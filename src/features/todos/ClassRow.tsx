import type { Lesson } from '@/db/db'
import { cn } from '@/lib/cn'
import { formatShort, fromISODate } from '@/lib/date'
import { coverOn, isFromEarlierWeek } from '@/features/timetable/cover'
import { KIND_LABELS, KIND_TEXT } from '@/features/timetable/layout'
import { semesterWeek } from '@/features/timetable/semester'

/**
 * One class occurrence with its tick box — `#L2 (17.09)`, struck through once
 * covered, its date red when it has been carried over from an earlier week.
 *
 * Shared by the Today tab's subject groups (`SubjectList`) and the subject
 * folder view, which show the same occurrences from different angles: the
 * first only what's outstanding today, the second the subject as a whole. The
 * row is the one place that decides how an occurrence reads, so the two can't
 * drift apart.
 */
export function ClassRow({
  lesson,
  date,
  today,
  onToggle,
}: {
  lesson: Lesson
  date: string
  today: string
  onToggle: () => void
}) {
  const cover = coverOn(lesson, date)
  const week = semesterWeek(fromISODate(date))
  const stale = !cover && isFromEarlierWeek(date, today)

  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-1 pr-2 text-left text-sm"
    >
      <span className="flex h-9 w-8 shrink-0 items-center justify-center">
        <span
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded border-[1.5px] text-xs',
            cover ? 'border-done bg-done-dim text-parchment' : 'border-brass-dim',
          )}
        >
          {cover && '✓'}
        </span>
      </span>
      <span className="min-w-0 flex-1 py-1.5">
        <span
          className={cn(
            'flex items-baseline gap-1',
            cover ? 'text-dim line-through' : 'text-parchment',
          )}
        >
          <span className={cn('shrink-0 font-mono text-xs', KIND_TEXT[lesson.kind])}>
            #{KIND_LABELS[lesson.kind]}
            {week ?? ''}
          </span>
          <span className={cn('shrink-0 text-xs', stale ? 'text-missed' : 'text-muted')}>
            ({formatShort(fromISODate(date))})
          </span>
        </span>
        {lesson.absentDates?.includes(date) && (
          <span className="mt-0.5 block text-xs text-missed">marked absent</span>
        )}
      </span>
    </button>
  )
}
