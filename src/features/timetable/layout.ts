import type { Lesson, LessonKind } from '@/db/db'
import { weekdayIndex, type WeekdayIndex } from '@/lib/date'
import { timeToMinutes } from '@/lib/time'

/** The grid window: Mon–Fri, 08:00–20:00. */
export const DAY_START = 8 * 60
export const DAY_END = 20 * 60
export const DAYS: WeekdayIndex[] = [0, 1, 2, 3, 4]
export const HOURS = Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, i) => 8 + i)

/** Minutes the grid spans. */
export const SPAN = DAY_END - DAY_START

/**
 * Rows are days and the horizontal axis is time, matching the routine grid's
 * reading direction. Horizontal offsets are percentages, not pixels, so the
 * whole 08:00–20:00 window always fits the screen exactly with nothing to
 * scroll — the cost is that an hour is only as wide as the viewport allows.
 */
export const ROW_HEIGHT = 52
export const HEADER_HEIGHT = 16
/** Width of the day-label gutter, in pixels. */
export const GUTTER = 28

export const GRID_HEIGHT = ROW_HEIGHT * DAYS.length

/** Where `minutes` sits along the horizontal axis, as a 0..100 percentage. */
export function pctOfDay(minutes: number): number {
  return ((minutes - DAY_START) / SPAN) * 100
}

export const KINDS: LessonKind[] = ['lecture', 'seminar', 'lab']

/** Short label, matching how the user writes their own timetable. */
export const KIND_LABELS: Record<LessonKind, string> = {
  lecture: 'L',
  seminar: 'C',
  lab: 'LAB',
}

export const KIND_NAMES: Record<LessonKind, string> = {
  lecture: 'lecture',
  seminar: 'seminar',
  lab: 'lab',
}

/**
 * Backgrounds are fully opaque on purpose: the hour lines are painted behind the
 * blocks, so a translucent fill would let the grid show through a lesson that
 * spans more than one hour.
 */
export const KIND_STYLES: Record<LessonKind, string> = {
  lecture: 'border-lecture bg-lecture-dim',
  seminar: 'border-seminar bg-seminar-dim',
  lab: 'border-lab bg-lab-dim',
}

/** A lesson resolved to offsets inside its day row, all percentages. */
export interface Placed {
  lesson: Lesson
  /** percentage from the start of the day */
  left: number
  width: number
  /** percentages of the row — overlapping lessons stack within its height */
  top: string
  height: string
}

function clampToWindow(minutes: number): number {
  return Math.min(Math.max(minutes, DAY_START), DAY_END)
}

function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}

/**
 * Lay one day's lessons out as offsets within its row. Lessons that overlap in
 * time are stacked within the row height — a timetable shouldn't have clashes,
 * but hiding one behind another would make a mistake invisible rather than
 * obvious.
 */
export function placeDay(lessons: Lesson[]): Placed[] {
  const sorted = [...lessons].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start))
  const placed: Placed[] = []
  let cluster: Lesson[] = []
  let clusterEnd = -1

  function flush() {
    for (const [i, lesson] of cluster.entries()) {
      const start = clampToWindow(timeToMinutes(lesson.start))
      const end = clampToWindow(timeToMinutes(lesson.end))
      placed.push({
        lesson,
        left: pctOfDay(start),
        width: ((end - start) / SPAN) * 100,
        top: `${(i / cluster.length) * 100}%`,
        height: `${100 / cluster.length}%`,
      })
    }
    cluster = []
    clusterEnd = -1
  }

  for (const lesson of sorted) {
    if (cluster.length && timeToMinutes(lesson.start) >= clusterEnd) flush()
    cluster.push(lesson)
    clusterEnd = Math.max(clusterEnd, timeToMinutes(lesson.end))
  }
  if (cluster.length) flush()

  return placed
}

/** Group lessons by weekday, each day already laid out. */
export function placeWeek(lessons: Lesson[]): Record<number, Placed[]> {
  const byDay: Record<number, Placed[]> = {}
  for (const day of DAYS) {
    byDay[day] = placeDay(lessons.filter((l) => l.day === day))
  }
  return byDay
}

/** Where the "now" line sits, or null when it falls outside the grid. */
export interface NowMarker {
  day: WeekdayIndex
  /** percentage from the start of the day */
  left: number
}

/**
 * The current time as a grid position. Null at the weekend (the timetable is a
 * weekday template — there is no row to point at) and outside 08:00–20:00.
 */
export function nowMarker(now: Date): NowMarker | null {
  const day = weekdayIndex(now)
  if (day > 4) return null

  const minutes = minutesOfDay(now)
  if (minutes < DAY_START || minutes > DAY_END) return null

  return { day, left: pctOfDay(minutes) }
}

/**
 * How much of a day row is already behind us, as a 0..100 percentage: all of it
 * for a day earlier in the week, a part of today, none of what's still ahead.
 *
 * Returns 0 for every day at the weekend. Greying the entire board from Saturday
 * morning would say nothing useful — by then the week reads as the one ahead.
 */
export function elapsedPct(day: WeekdayIndex, now: Date): number {
  const today = weekdayIndex(now)
  if (today > 4) return 0
  if (day < today) return 100
  if (day > today) return 0

  return Math.min(Math.max(pctOfDay(minutesOfDay(now)), 0), 100)
}

/**
 * Which hour a tap landed on, given how far across the row it fell (0..1),
 * snapped down. Capped an hour short of the window's end so the slot always has
 * room for a lesson.
 */
export function hourAt(ratio: number): number {
  const minutes = DAY_START + ratio * SPAN
  const hour = Math.floor(minutes / 60) * 60
  return Math.min(clampToWindow(hour), DAY_END - 60)
}
