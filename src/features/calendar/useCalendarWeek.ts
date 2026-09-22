import { useMemo, useState } from 'react'
import { addDays, mondayOf, weekDates } from '@/lib/date'

export interface CalendarWeekState {
  /** offset in weeks from the current week (0 = this week) */
  offset: number
  monday: Date
  dates: Date[]
  isCurrent: boolean
  prev: () => void
  next: () => void
  reset: () => void
}

/**
 * Week paging, unbounded — unlike routines' `useWeek`, which clamps to the
 * calendar year containing today (a habit-tracking cycle resets yearly). A
 * todo can be dated any year, so paging here must not hit an artificial wall
 * in either direction: an old week has to stay reachable to review what was
 * planned, and a far-future one to plan ahead.
 */
export function useCalendarWeek(): CalendarWeekState {
  const [offset, setOffset] = useState(0)

  return useMemo(() => {
    const thisMonday = mondayOf(new Date())
    const monday = addDays(thisMonday, offset * 7)
    return {
      offset,
      monday,
      dates: weekDates(monday),
      isCurrent: offset === 0,
      prev: () => setOffset((o) => o - 1),
      next: () => setOffset((o) => o + 1),
      reset: () => setOffset(0),
    }
  }, [offset])
}
