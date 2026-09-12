import { useMemo, useState } from 'react'
import {
  addDays,
  firstMondayOfYear,
  lastMondayOfYear,
  mondayOf,
  weekDates,
  weeksBetween,
} from '@/lib/date'

export interface WeekState {
  /** offset in weeks from the current week (0 = this week) */
  offset: number
  monday: Date
  dates: Date[]
  isCurrent: boolean
  /** false at the year's first week — `prev` is a no-op there */
  canPrev: boolean
  /** false at the year's last week — `next` is a no-op there */
  canNext: boolean
  prev: () => void
  next: () => void
  reset: () => void
}

/**
 * Week paging, clamped to the calendar year that contains today: back to the
 * week holding 1 January and forward to the week holding 31 December. Either
 * edge week may spill into the neighbouring year — the limit is the week, not
 * the date.
 */
export function useWeek(): WeekState {
  const [offset, setOffset] = useState(0)

  return useMemo(() => {
    const today = new Date()
    const thisMonday = mondayOf(today)
    const year = today.getFullYear()
    const minOffset = weeksBetween(thisMonday, firstMondayOfYear(year))
    const maxOffset = weeksBetween(thisMonday, lastMondayOfYear(year))

    const monday = addDays(thisMonday, offset * 7)
    return {
      offset,
      monday,
      dates: weekDates(monday),
      isCurrent: offset === 0,
      canPrev: offset > minOffset,
      canNext: offset < maxOffset,
      prev: () => setOffset((o) => Math.max(o - 1, minOffset)),
      next: () => setOffset((o) => Math.min(o + 1, maxOffset)),
      reset: () => setOffset(0),
    }
  }, [offset])
}
