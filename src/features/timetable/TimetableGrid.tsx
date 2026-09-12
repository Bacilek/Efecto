import type { MouseEvent } from 'react'
import { useMemo } from 'react'
import type { Lesson } from '@/db/db'
import { cn } from '@/lib/cn'
import { DAY_LABELS, type WeekdayIndex } from '@/lib/date'
import { useNow } from '@/lib/useNow'
import {
  DAYS,
  GRID_HEIGHT,
  GUTTER,
  HEADER_HEIGHT,
  HOURS,
  KIND_STYLES,
  ROW_HEIGHT,
  elapsedPct,
  hourAt,
  nowMarker,
  pctOfDay,
  placeWeek,
} from './layout'

export function TimetableGrid({
  lessons,
  showNow,
  onTapLesson,
  onTapSlot,
}: {
  lessons: Lesson[]
  /** whether the week on screen is the one we're in — gates the "now" marker */
  showNow: boolean
  onTapLesson: (lesson: Lesson) => void
  /** empty slot tapped — `startMinutes` is the hour it landed on */
  onTapSlot: (day: WeekdayIndex, startMinutes: number) => void
}) {
  const byDay = useMemo(() => placeWeek(lessons), [lessons])
  const now = useNow()
  const marker = showNow ? nowMarker(now) : null

  function slotTap(day: WeekdayIndex, e: MouseEvent<HTMLButtonElement>) {
    const { left, width } = e.currentTarget.getBoundingClientRect()
    onTapSlot(day, hourAt((e.clientX - left) / width))
  }

  return (
    <div className="flex px-4 pb-2">
      <div className="shrink-0" style={{ width: GUTTER, paddingTop: HEADER_HEIGHT }}>
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

      <div className="min-w-0 flex-1">
        <div className="relative" style={{ height: HEADER_HEIGHT }}>
          {HOURS.slice(0, -1).map((h) => (
            <span
              key={h}
              className="absolute font-mono text-[10px] text-dim"
              style={{ left: `${pctOfDay(h * 60)}%`, paddingLeft: 2 }}
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
              style={{ left: `${pctOfDay(h * 60)}%` }}
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
                  style={{ left: `${left}%`, width: `${width}%`, top, height, minWidth: 22 }}
                  className={cn(
                    'absolute overflow-hidden rounded border-[1.5px] px-0.5 py-0.5 text-left',
                    KIND_STYLES[lesson.kind],
                  )}
                >
                  <span className="block truncate text-[10px] leading-tight text-parchment">
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

              <ElapsedShade pct={showNow ? elapsedPct(d, now) : 0} />
              {marker?.day === d && <NowLine pct={marker.left} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Dims the part of a day that has already happened. Sits above the lesson
 * blocks so it shades them too, and never swallows a tap.
 */
function ElapsedShade({ pct }: { pct: number }) {
  if (pct <= 0) return null
  return (
    <div
      className="pointer-events-none absolute inset-y-0 left-0 bg-ink/60"
      style={{ width: `${pct}%` }}
      aria-hidden
    />
  )
}

/** The current time, to the minute, down today's row. */
function NowLine({ pct }: { pct: number }) {
  return (
    <div
      className="pointer-events-none absolute inset-y-0 z-10"
      style={{ left: `${pct}%` }}
      aria-hidden
    >
      <div className="h-full w-px bg-brass" />
      <div className="absolute -left-[3px] top-0 h-[7px] w-[7px] rounded-full bg-brass" />
    </div>
  )
}
