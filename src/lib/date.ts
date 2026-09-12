/**
 * Date helpers. Week starts on Monday. Weekday index is 0=Mon .. 6=Sun
 * (differs from JS `Date.getDay()` where 0=Sun).
 */

export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6

export const DAY_LABELS: readonly string[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const DAY_LABELS_LONG: readonly string[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

/** 0=Mon .. 6=Sun for a given date. */
export function weekdayIndex(d: Date): WeekdayIndex {
  return ((d.getDay() + 6) % 7) as WeekdayIndex
}

/** Local-date ISO string `YYYY-MM-DD` (no timezone shift). */
export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Monday 00:00 of the week containing `d`. */
export function mondayOf(d: Date): Date {
  const dt = new Date(d)
  dt.setHours(0, 0, 0, 0)
  dt.setDate(dt.getDate() - weekdayIndex(dt))
  return dt
}

export function addDays(d: Date, n: number): Date {
  const dt = new Date(d)
  dt.setDate(dt.getDate() + n)
  return dt
}

/** The 7 dates Mon..Sun of the week containing `d`. */
export function weekDates(d: Date): Date[] {
  const mon = mondayOf(d)
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i))
}

/**
 * Monday 00:00 of the week containing 1 January of `year`. May land in the
 * previous December — that week is still the year's first.
 */
export function firstMondayOfYear(year: number): Date {
  return mondayOf(new Date(year, 0, 1))
}

/**
 * Monday 00:00 of the week containing 31 December of `year`. That week may run
 * on into the next January.
 */
export function lastMondayOfYear(year: number): Date {
  return mondayOf(new Date(year, 11, 31))
}

/**
 * Whole weeks from `a` to `b`, comparing the Mondays of their weeks; negative
 * when `b` is earlier. Rounded, so DST shifts can't bias the result.
 */
export function weeksBetween(a: Date, b: Date): number {
  const ms = mondayOf(b).getTime() - mondayOf(a).getTime()
  return Math.round(ms / (7 * 24 * 60 * 60 * 1000))
}

/**
 * ISO-8601 week number (1..53): weeks run Mon–Sun and week 1 is the one holding
 * the year's first Thursday, so early January can still belong to week 52/53 of
 * the year before.
 */
export function isoWeek(d: Date): number {
  // ISO weeks are identified by their Thursday — compare this week's to the
  // first Thursday of the year that Thursday falls in.
  const thursday = mondayOf(d)
  thursday.setDate(thursday.getDate() + 3)

  const firstThursday = mondayOf(new Date(thursday.getFullYear(), 0, 4))
  firstThursday.setDate(firstThursday.getDate() + 3)

  return 1 + weeksBetween(firstThursday, thursday)
}

export type WeekParity = 'odd' | 'even'

/** Whether a week number is odd or even. */
export function weekParity(week: number): WeekParity {
  return week % 2 === 0 ? 'even' : 'odd'
}

/** `dd.mm` */
export function formatShort(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function isSameDay(a: Date, b: Date): boolean {
  return toISODate(a) === toISODate(b)
}

export function todayISO(): string {
  return toISODate(new Date())
}
