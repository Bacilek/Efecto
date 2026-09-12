/** Clock helpers for "HH:MM" strings (24h, no timezone involved). */

/** Minutes since midnight for "H:MM" / "HH:MM"; NaN-safe, returns 0 on junk. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** "HH:MM" for minutes since midnight. */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
