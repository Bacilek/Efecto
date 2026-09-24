import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { formatShort, fromISODate } from '@/lib/date'

/**
 * One dated occurrence with its tick box — a badge, the date in parentheses,
 * struck through once done, the date red when it has been carried over from
 * an earlier week.
 *
 * Both kinds of weekly school work render through this: a class from the
 * timetable (`ClassRow`) and a weekly task that stacks the same way
 * (`WeeklyRow`). They are the same shape of thing — work owed for a
 * particular week, ticked off per occurrence — so they are literally the same
 * component, and can't drift into looking like two unrelated ideas.
 *
 * `onOpen` is the only structural branch: without it the whole row is one
 * button (a class has nothing to edit from here), with it the tick box and
 * the body split into two, the way every todo row already behaves.
 */
export function OccurrenceRow({
  badge,
  date,
  done,
  stale,
  label,
  sub,
  onToggle,
  onOpen,
}: {
  /** the mono `#L2` / `#W3` chip, colour included */
  badge: ReactNode
  /** ISO date, rendered as `(17.09)` */
  date: string
  done: boolean
  /** carried over from an earlier week — reddens the date */
  stale: boolean
  /** trailing title, for a weekly task; a class is named by its badge alone */
  label?: string
  /** optional second line, e.g. "marked absent" */
  sub?: ReactNode
  onToggle: () => void
  /** when set, tapping the body opens the editor instead of ticking */
  onOpen?: () => void
}) {
  const mark = (
    <span
      className={cn(
        'flex h-5 w-5 items-center justify-center rounded border-[1.5px] text-xs',
        done ? 'border-done bg-done-dim text-parchment' : 'border-brass-dim',
      )}
    >
      {done && '✓'}
    </span>
  )

  const body = (
    <span className="min-w-0 flex-1 py-1.5">
      <span
        className={cn(
          'flex items-baseline gap-1',
          done ? 'text-dim line-through' : 'text-parchment',
        )}
      >
        {label && <span className="min-w-0 truncate text-sm">{label}</span>}
        {badge}
        <span className={cn('shrink-0 text-xs', stale ? 'text-missed' : 'text-muted')}>
          ({formatShort(fromISODate(date))})
        </span>
      </span>
      {sub}
    </span>
  )

  // A class row has nothing to open, so the whole row is one tick target —
  // the markup it has always had.
  if (!onOpen) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-1 pr-2 text-left text-sm"
      >
        <span className="flex h-9 w-8 shrink-0 items-center justify-center">{mark}</span>
        {body}
      </button>
    )
  }

  return (
    <span className="flex w-full items-center gap-1 pr-2 text-left text-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-label={done ? 'Mark as not done' : 'Mark as done'}
        className="flex h-9 w-8 shrink-0 items-center justify-center"
      >
        {mark}
      </button>
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 text-left">
        {body}
      </button>
    </span>
  )
}
