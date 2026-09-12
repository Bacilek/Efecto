import type { Lesson, LessonKind } from '@/db/db'
import type { WeekdayIndex } from '@/lib/date'
import { timeToMinutes } from '@/lib/time'

/** The grid window: Mon–Fri, 08:00–20:00. */
export const DAY_START = 8 * 60
export const DAY_END = 20 * 60
export const DAYS: WeekdayIndex[] = [0, 1, 2, 3, 4]
export const HOURS = Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, i) => 8 + i)

/** Row height. One hour of the day is this many pixels tall. */
export const PX_PER_MIN = 54 / 60

export const GRID_HEIGHT = (DAY_END - DAY_START) * PX_PER_MIN

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

export const KIND_STYLES: Record<LessonKind, string> = {
  lecture: 'border-lecture bg-lecture-dim/60',
  seminar: 'border-seminar bg-seminar-dim/60',
  lab: 'border-lab bg-lab-dim/60',
}

/** A lesson resolved to pixel offsets inside one day column. */
export interface Placed {
  lesson: Lesson
  top: number
  height: number
  /** percentages — overlapping lessons split the column's width between them */
  left: string
  width: string
}

function clampToWindow(minutes: number): number {
  return Math.min(Math.max(minutes, DAY_START), DAY_END)
}

/**
 * Lay one day's lessons out as absolute offsets. Lessons that overlap in time
 * are split side by side — a timetable shouldn't have clashes, but hiding one
 * behind another would make a mistake invisible rather than obvious.
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
        top: (start - DAY_START) * PX_PER_MIN,
        // keep a very short lesson tall enough to stay tappable
        height: Math.max(20, (end - start) * PX_PER_MIN),
        left: `${(i / cluster.length) * 100}%`,
        width: `${100 / cluster.length}%`,
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

/**
 * Which hour a tap at `y` pixels inside the grid landed on, snapped down. Capped
 * an hour short of the window's end so the slot always has room for a lesson.
 */
export function hourAt(y: number): number {
  const minutes = DAY_START + y / PX_PER_MIN
  const hour = Math.floor(minutes / 60) * 60
  return Math.min(clampToWindow(hour), DAY_END - 60)
}
