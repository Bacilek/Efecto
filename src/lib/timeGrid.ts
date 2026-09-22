/**
 * Shared math for a "rows = weekdays, horizontal axis = time" grid — the
 * pattern both the timetable and the calendar use, each with its own day
 * count and time window. Pulled out so the "now" line and elapsed-shading
 * formulas exist in exactly one place.
 */
import { weekdayIndex, type WeekdayIndex } from '@/lib/date'

export interface TimeWindow {
  start: number
  end: number
}

/** Where `minutes` sits within `win`, as a 0..100 percentage. */
export function pctOfWindow(minutes: number, win: TimeWindow): number {
  return ((minutes - win.start) / (win.end - win.start)) * 100
}

function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}

export interface GridNowMarker {
  day: WeekdayIndex
  /** percentage from the start of the window */
  left: number
}

/**
 * The current time as a grid position, or null once it falls outside the
 * visible days (`dayCount`, 0=Mon-based) or outside `win`.
 */
export function nowMarkerIn(now: Date, win: TimeWindow, dayCount: number): GridNowMarker | null {
  const day = weekdayIndex(now)
  if (day >= dayCount) return null

  const minutes = minutesOfDay(now)
  if (minutes < win.start || minutes > win.end) return null

  return { day, left: pctOfWindow(minutes, win) }
}

/**
 * How much of a day row is already behind us, as a 0..100 percentage: all of
 * it for a day earlier in the week, a part of today, none of what's still
 * ahead. Returns 0 for every day once `dayCount` no longer covers today (e.g.
 * the timetable's weekday-only grid over a weekend).
 */
export function elapsedPctIn(
  day: WeekdayIndex,
  now: Date,
  win: TimeWindow,
  dayCount: number,
): number {
  const today = weekdayIndex(now)
  if (today >= dayCount) return 0
  if (day < today) return 100
  if (day > today) return 0

  return Math.min(Math.max(pctOfWindow(minutesOfDay(now), win), 0), 100)
}
