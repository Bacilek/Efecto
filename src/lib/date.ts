/**
 * Date helpers. Week starts on Monday. Weekday index is 0=Mon .. 6=Sun
 * (differs from JS `Date.getDay()` where 0=Sun).
 */

export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6

export const DAY_LABELS: readonly string[] = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']
export const DAY_LABELS_LONG: readonly string[] = [
  'Pondělí',
  'Úterý',
  'Středa',
  'Čtvrtek',
  'Pátek',
  'Sobota',
  'Neděle',
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
