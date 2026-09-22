import type { Todo } from '@/db/db'
import { toISODate, type WeekdayIndex } from '@/lib/date'
import { timeToMinutes } from '@/lib/time'
import { elapsedPctIn, nowMarkerIn, pctOfWindow, type TimeWindow } from '@/lib/timeGrid'

/**
 * Rows are the 7 weekdays and the horizontal axis is time, matching the
 * timetable's reading direction. Unlike the timetable, the default window
 * isn't the full day: 00:00–23:59 across 7 days at the timetable's
 * percentage-width approach would roughly halve its already-tight ~27px/hour
 * (12h/5 days) down to ~12px, illegible on a phone. 06:00–24:00 covers the
 * hours that actually hold something and lands its end exactly on the day
 * boundary, so an evening item stays visible with no special case; the
 * rarely-used 00:00–06:00 stays one tap away via the expand toggle.
 */
export const CAL_START = 6 * 60
export const CAL_END = 24 * 60
export const DAYS: WeekdayIndex[] = [0, 1, 2, 3, 4, 5, 6]

export const ROW_HEIGHT = 52
export const HEADER_HEIGHT = 22
/** Width of the day-label gutter, in pixels — matches the timetable's. */
export const GUTTER = 46

export const GRID_HEIGHT = ROW_HEIGHT * DAYS.length

/** The active window: the default, or the full day once expanded to show 00:00–06:00. */
export function windowFor(expanded: boolean): TimeWindow {
  return { start: expanded ? 0 : CAL_START, end: CAL_END }
}

/** Where `minutes` sits along the horizontal axis, as a 0..100 percentage. */
export function pctOfDay(minutes: number, win: TimeWindow): number {
  return pctOfWindow(minutes, win)
}

/** Whole hours `win` spans, i.e. how many hour columns there are. */
export function hourCount(win: TimeWindow): number {
  return (win.end - win.start) / 60
}

/** Width of one hour column, as a percentage — labels centre themselves on it. */
export function hourPct(win: TimeWindow): number {
  return 100 / hourCount(win)
}

/** The whole hours `win` spans, inclusive of both ends. */
export function hoursOf(win: TimeWindow): number[] {
  return Array.from({ length: hourCount(win) + 1 }, (_, i) => win.start / 60 + i)
}

function clampToWindow(minutes: number, win: TimeWindow): number {
  return Math.min(Math.max(minutes, win.start), win.end)
}

/** A todo resolved to offsets inside its day row, all percentages. */
export interface PlacedTodo {
  todo: Todo
  /** percentage from the start of the window */
  left: number
  width: number
  /** percentages of the row — overlapping todos stack within its height */
  top: string
  height: string
}

/** Belongs in the timed grid rather than the all-day strip. */
export function isTimed(todo: Todo): boolean {
  return !todo.allDay && !!todo.startTime && !!todo.endTime
}

/**
 * Lay one day's timed todos out as offsets within its row. Todos that overlap
 * in time stack within the row height, same spirit as the timetable — a clash
 * stays visible instead of one block hiding another.
 */
export function placeDay(todos: Todo[], win: TimeWindow): PlacedTodo[] {
  const sorted = [...todos]
    .filter(isTimed)
    .sort((a, b) => timeToMinutes(a.startTime!) - timeToMinutes(b.startTime!))
  const placed: PlacedTodo[] = []
  let cluster: Todo[] = []
  let clusterEnd = -1

  function flush() {
    for (const [i, todo] of cluster.entries()) {
      const start = clampToWindow(timeToMinutes(todo.startTime!), win)
      const end = clampToWindow(timeToMinutes(todo.endTime!), win)
      placed.push({
        todo,
        left: pctOfWindow(start, win),
        width: ((end - start) / (win.end - win.start)) * 100,
        top: `${(i / cluster.length) * 100}%`,
        height: `${100 / cluster.length}%`,
      })
    }
    cluster = []
    clusterEnd = -1
  }

  for (const todo of sorted) {
    if (cluster.length && timeToMinutes(todo.startTime!) >= clusterEnd) flush()
    cluster.push(todo)
    clusterEnd = Math.max(clusterEnd, timeToMinutes(todo.endTime!))
  }
  if (cluster.length) flush()

  return placed
}

/** Group todos by weekday, each day already laid out. `dates` is that week's Mon–Sun. */
export function placeWeek(
  todos: Todo[],
  dates: Date[],
  win: TimeWindow,
): Record<number, PlacedTodo[]> {
  const byDay: Record<number, PlacedTodo[]> = {}
  for (const [i, day] of DAYS.entries()) {
    const dateISO = toISODate(dates[i])
    byDay[day] = placeDay(
      todos.filter((t) => t.plannedFor === dateISO),
      win,
    )
  }
  return byDay
}

/** Where the "now" line sits, or null when it falls outside the visible window. */
export interface NowMarker {
  day: WeekdayIndex
  /** percentage from the start of the window */
  left: number
}

export function nowMarker(now: Date, win: TimeWindow): NowMarker | null {
  return nowMarkerIn(now, win, DAYS.length)
}

export function elapsedPct(day: WeekdayIndex, now: Date, win: TimeWindow): number {
  return elapsedPctIn(day, now, win, DAYS.length)
}

/**
 * Which hour a tap landed on, given how far across the row it fell (0..1),
 * snapped down. Capped an hour short of the window's end so the slot always
 * has room for a default 60-minute block.
 */
export function hourAt(ratio: number, win: TimeWindow): number {
  const minutes = win.start + ratio * (win.end - win.start)
  const hour = Math.floor(minutes / 60) * 60
  return Math.min(clampToWindow(hour, win), win.end - 60)
}
