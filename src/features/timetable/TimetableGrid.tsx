import type { MouseEvent } from 'react'
import { useMemo } from 'react'
import type { Lesson } from '@/db/db'
import { cn } from '@/lib/cn'
import { DAY_LABELS, type WeekdayIndex } from '@/lib/date'
import { useNow } from '@/lib/useNow'
import {
  DAYS,
  DAY_START,
  GRID_HEIGHT,
  GRID_WIDTH,
  GUTTER,
  HEADER_HEIGHT,
  HOURS,
  KIND_STYLES,
  PX_PER_MIN,
  ROW_HEIGHT,
  elapsedWidth,
  hourAt,
  nowMarker,
  placeWeek,
} from './layout'

/** Pixels from the left edge of the grid for a given whole hour. */
function hourOffset(hour: number): number {
  return (hour * 60 - DAY_START) * PX_PER_MIN
}

export function TimetableGrid({
  lessons,
  onTapLesson,
  onTapSlot,
}: {
  lessons: Lesson[]
  onTapLesson: (lesson: Lesson) => void
  /** empty slot tapped — `startMinutes` is the hour it landed on */
  onTapSlot: (day: WeekdayIndex, startMinutes: number) => void
}) {
  const byDay = useMemo(() => placeWeek(lessons), [lessons])
  const now = useNow()
  const marker = nowMarker(now)

  function slotTap(day: WeekdayIndex, e: MouseEvent<HTMLButtonElement>) {
    const { left } = e.currentTarget.getBoundingClientRect()
    onTapSlot(day, hourAt(e.clientX - left))
  }

  return (
    <div className="overflow-x-auto px-4 pb-2">
      <div className="flex" style={{ width: GUTTER + GRID_WIDTH }}>
        {/* day labels stay put while the hours scroll under them */}
        <div
          className="sticky left-0 z-20 shrink-0 bg-ink"
          style={{ width: GUTTER, paddingTop: HEADER_HEIGHT }}
        >
          {DAYS.map((d) => (
            <div
              key={d}
              className="flex items-center text-[11px] text-muted"
              style={{ height: ROW_HEIGHT }}
            >
              {DAY_LABELS[d]}
            </div>
          ))}
        </div>

        <div className="shrink-0" style={{ width: GRID_WIDTH }}>
          <div className="relative" style={{ height: HEADER_HEIGHT }}>
            {HOURS.slice(0, -1).map((h) => (
              <span
                key={h}
                className="absolute font-mono text-[10px] text-dim"
                style={{ left: hourOffset(h) + 2 }}
              >
                {h}
              </span>
            ))}
          </div>

          <div
            className="relative overflow-hidden rounded-md border border-line-soft bg-panel"
            style={{ height: GRID_HEIGHT }}
          >
            {HOURS.slice(1, -1).map((h) => (
              <div
                key={h}
                className="absolute inset-y-0 border-l border-line-soft"
                style={{ left: hourOffset(h) }}
              />
            ))}

            {DAYS.map((d, i) => (
              <div
                key={d}
                className={cn('absolute inset-x-0', i > 0 && 'border-t border-line-soft')}
                style={{ top: i * ROW_HEIGHT, height: ROW_HEIGHT }}
              >
                <button
                  type="button"
                  className="absolute inset-0 h-full w-full"
                  onClick={(e) => slotTap(d, e)}
                  aria-label={`Add a lesson on ${DAY_LABELS[d]}`}
                />
                {byDay[d].map(({ lesson, left, width, top, height }) => (
                  <button
                    key={lesson.id}
                    type="button"
                    onClick={() => onTapLesson(lesson)}
                    style={{ left, width, top, height }}
                    className={cn(
                      'absolute overflow-hidden rounded border-[1.5px] px-1 py-0.5 text-left',
                      KIND_STYLES[lesson.kind],
                    )}
                  >
                    <span className="block truncate text-[11px] leading-tight text-parchment">
                      {lesson.name}
                      {lesson.group && <span className="text-muted">/{lesson.group}</span>}
                    </span>
                    {lesson.room && (
                      <span className="block truncate font-mono text-[9px] leading-tight text-muted">
                        {lesson.room}
                      </span>
                    )}
                  </button>
                ))}

                <ElapsedShade width={elapsedWidth(d, now)} />
                {marker?.day === d && <NowLine left={marker.left} />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Dims the part of a day that has already happened. Sits above the lesson
 * blocks so it shades them too, and never swallows a tap.
 */
function ElapsedShade({ width }: { width: number }) {
  if (width <= 0) return null
  return (
    <div
      className="pointer-events-none absolute inset-y-0 left-0 bg-ink/60"
      style={{ width }}
      aria-hidden
    />
  )
}

/** The current time, to the minute, down today's row. */
function NowLine({ left }: { left: number }) {
  return (
    <div className="pointer-events-none absolute inset-y-0 z-10" style={{ left }} aria-hidden>
      <div className="h-full w-px bg-brass" />
      <div className="absolute -left-[3px] top-0 h-[7px] w-[7px] rounded-full bg-brass" />
    </div>
  )
}
