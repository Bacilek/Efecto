import type { MouseEvent } from 'react'
import { useMemo } from 'react'
import type { Lesson } from '@/db/db'
import { cn } from '@/lib/cn'
import {
  DAY_LABELS,
  formatShort,
  weekdayIndex,
  type WeekdayIndex,
  type WeekParity,
} from '@/lib/date'
import { useNow } from '@/lib/useNow'
import {
  DAYS,
  GRID_HEIGHT,
  GUTTER,
  HEADER_HEIGHT,
  HOURS,
  HOUR_PCT,
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
  dates,
  parity,
  showNow,
  onTapLesson,
  onTapSlot,
}: {
  lessons: Lesson[]
  /** Mon–Fri of the week on screen, for resolving per-date exceptions */
  dates: Date[]
  /** parity of the week on screen, for odd/even-only lessons */
  parity: WeekParity | null
  /** whether the week on screen is the one we're in — gates the "now" marker */
  showNow: boolean
  onTapLesson: (lesson: Lesson) => void
  /** empty slot tapped — `startMinutes` is the hour it landed on */
  onTapSlot: (day: WeekdayIndex, startMinutes: number) => void
}) {
  const byDay = useMemo(() => placeWeek(lessons, dates, parity), [lessons, dates, parity])
  const now = useNow()
  const marker = showNow ? nowMarker(now) : null

  function slotTap(day: WeekdayIndex, e: MouseEvent<HTMLButtonElement>) {
    const { left, width } = e.currentTarget.getBoundingClientRect()
    onTapSlot(day, hourAt((e.clientX - left) / width))
  }

  return (
    <div className="flex px-4 pb-2">
      <div
        className="shrink-0"
        style={{ width: GUTTER, paddingTop: HEADER_HEIGHT, paddingRight: 6 }}
      >
        {DAYS.map((d, i) => (
          <div
            key={d}
            className="flex flex-col items-center justify-center leading-tight"
            style={{ height: ROW_HEIGHT }}
          >
            <span
              className={cn(
                'text-[13px]',
                showNow && weekdayIndex(now) === d ? 'text-brass' : 'text-parchment',
              )}
            >
              {DAY_LABELS[d]}
            </span>
            {dates[i] && (
              <span className="font-mono text-[10px] text-muted">{formatShort(dates[i])}</span>
            )}
          </div>
        ))}
      </div>

      <div className="min-w-0 flex-1">
        <div className="relative" style={{ height: HEADER_HEIGHT }}>
          {HOURS.slice(0, -1).map((h) => (
            <div
              key={h}
              className={cn(
                'absolute bottom-0 top-0 pl-1 text-left font-mono text-[11px] text-muted',
                // the tick shows which hour column the label opens
                h > 8 && 'border-l border-line-soft',
              )}
              style={{ left: `${pctOfDay(h * 60)}%`, width: `${HOUR_PCT}%` }}
            >
              {/* Every hour gets a tick, but only every other one is labelled:
                  "19:00" needs 36px and an hour column is 27.5px on a phone, so
                  labelling all twelve would overlap. Even hours match the
                  two-hour rhythm the lessons are on. */}
              {(h - HOURS[0]) % 2 === 0 && `${h}:00`}
            </div>
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
              className={cn(
                'absolute inset-x-0',
                i > 0 && 'border-t border-line-soft',
                // today's row is tinted, as it is in the routine grid
                showNow && weekdayIndex(now) === d && 'bg-today',
              )}
              style={{ top: i * ROW_HEIGHT, height: ROW_HEIGHT }}
            >
              <button
                type="button"
                className="absolute inset-0 h-full w-full"
                onClick={(e) => slotTap(d, e)}
                aria-label={`Add a lesson on ${DAY_LABELS[d]}`}
              />
              {byDay[d].map(({ lesson, happening, left, width, top, height }) => (
                <button
                  key={lesson.id}
                  type="button"
                  onClick={() => onTapLesson(lesson)}
                  style={{ left: `${left}%`, width: `${width}%`, top, height, minWidth: 22 }}
                  className={cn(
                    'absolute flex flex-col justify-center overflow-hidden rounded px-0.5 text-center',
                    happening
                      ? `border-[1.5px] ${KIND_STYLES[lesson.kind]}`
                      : 'border border-dashed border-line bg-panel-2',
                  )}
                >
                  <span
                    className={cn(
                      'w-full truncate text-[11px] leading-tight',
                      happening ? 'text-parchment' : 'text-dim line-through',
                    )}
                  >
                    {lesson.name}
                    {lesson.group && (
                      <span className={happening ? 'text-muted' : undefined}>/{lesson.group}</span>
                    )}
                  </span>
                  {lesson.room && (
                    <span
                      className={cn(
                        'w-full truncate font-mono text-[10px] leading-tight',
                        happening ? 'text-muted' : 'text-dim',
                      )}
                    >
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
