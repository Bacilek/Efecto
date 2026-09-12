import { useEffect, useState } from 'react'

/**
 * The current time, re-rendering on an interval (30 s by default). Coarse on
 * purpose: a "now" marker only has to land on the right minute, and ticking
 * every second would re-render the whole grid 60× as often for no visible gain.
 */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return now
}
