import { useMemo, useState } from 'react'
import { addDays, mondayOf, weekDates } from '@/lib/date'

export interface WeekState {
  /** offset in weeks from the current week (0 = this week) */
  offset: number
  monday: Date
  dates: Date[]
  isCurrent: boolean
  prev: () => void
  next: () => void
  reset: () => void
}

export function useWeek(): WeekState {
  const [offset, setOffset] = useState(0)

  return useMemo(() => {
    const monday = addDays(mondayOf(new Date()), offset * 7)
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
