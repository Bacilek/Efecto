import type { Lesson } from '@/db/db'
import { cn } from '@/lib/cn'
import { fromISODate } from '@/lib/date'
import { coverOn, isFromEarlierWeek } from '@/features/timetable/cover'
import { KIND_LABELS, KIND_TEXT } from '@/features/timetable/layout'
import { semesterWeek } from '@/features/timetable/semester'
import { OccurrenceRow } from './OccurrenceRow'

/**
 * One class occurrence — `#L2 (17.09)`. A thin wrapper that works out the
 * badge and the two flags; everything about how the row *reads* lives in
 * `OccurrenceRow`, which a weekly task renders through too.
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

  return (
    <OccurrenceRow
      badge={
        <span className={cn('shrink-0 font-mono text-xs', KIND_TEXT[lesson.kind])}>
          #{KIND_LABELS[lesson.kind]}
          {week ?? ''}
        </span>
      }
      date={date}
      done={cover}
      stale={!cover && isFromEarlierWeek(date, today)}
      sub={
        lesson.absentDates?.includes(date) ? (
          <span className="mt-0.5 block text-xs text-missed">marked absent</span>
        ) : null
      }
      onToggle={onToggle}
    />
  )
}
