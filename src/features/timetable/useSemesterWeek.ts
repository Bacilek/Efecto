import { useMemo, useState } from 'react'
import { addDays } from '@/lib/date'
import { semesterWeek, semesterWeekCount, semesterWeekMonday } from './semester'

export interface SemesterWeekState {
  /** 1-based semester week being viewed */
  week: number
  monday: Date
  /** Mon..Fri of that week */
  dates: Date[]
  /** the week we are actually in, or null when today is outside the semester */
  currentWeek: number | null
  isCurrent: boolean
  /** false at the semester's first week */
  canPrev: boolean
  /** false at the semester's last week */
  canNext: boolean
  prev: () => void
  next: () => void
  reset: () => void
}

/**
 * Which semester week the timetable is showing, clamped to the semester. The
 * timetable itself is a template with no dates, so paging only changes the week
 * label, its parity and whether the "now" marker applies — the lessons are the
 * same every week.
 */
export function useSemesterWeek(): SemesterWeekState {
  const count = semesterWeekCount()
  const currentWeek = semesterWeek(new Date())
  const [week, setWeek] = useState(currentWeek ?? 1)

  return useMemo(() => {
    const monday = semesterWeekMonday(week)
    return {
      week,
      monday,
      dates: Array.from({ length: 5 }, (_, i) => addDays(monday, i)),
      currentWeek,
      isCurrent: week === currentWeek,
      canPrev: week > 1,
      canNext: week < count,
      prev: () => setWeek((w) => Math.max(w - 1, 1)),
      next: () => setWeek((w) => Math.min(w + 1, count)),
      reset: () => setWeek(currentWeek ?? 1),
    }
  }, [week, count, currentWeek])
}
