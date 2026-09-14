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
import { CameraIcon } from '@/ui/CameraIcon'
import { absenceState } from './absence'
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

          {DAYS.map((d, i) => {
            // How much of this row is behind us, in the same 0..100 domain as
            // a lesson's own `left`/`width` — only lesson blocks grey out with
            // it (below), the grid itself is never touched.
            const cut = showNow ? elapsedPct(d, now) : 0
            return (
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
                {byDay[d].map(({ lesson, happening, left, width, top, height }) => {
                  // The fraction of *this block* that's already behind us: 0
                  // short of `cut`, 100 once it's fully past, in between while
                  // "now" falls inside it.
                  const elapsed =
                    happening && width > 0
                      ? Math.min(100, Math.max(0, ((cut - left) / width) * 100))
                      : 0
                  return (
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
                          <span className={happening ? 'text-muted' : undefined}>
                            /{lesson.group}
                          </span>
                        )}
                      </span>
                      {lesson.recorded && (
                        <CameraIcon
                          className={cn(
                            'pointer-events-none absolute right-px top-px',
                            happening ? 'text-parchment' : 'text-dim',
                          )}
                        />
                      )}
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
                      <AbsenceDots lesson={lesson} faded={!happening} />
                      <ElapsedShade pct={elapsed} />
                    </button>
                  )
                })}

                {marker?.day === d && <NowLine pct={marker.left} />}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/**
 * How many excused absences are left, along the block's bottom edge: one dot
 * per allowed absence, the spent ones filled red. Dots beat a "1/3" label here
 * — an hour column is ~27px on a phone, and the room already owns the text —
 * and they read peripherally, without counting. A full row of red means none
 * are left, so that one has to be attended.
 *
 * Past six the dots would not fit, so it falls back to "2 left".
 */
function AbsenceDots({ lesson, faded }: { lesson: Lesson; faded: boolean }) {
  const state = absenceState(lesson)
  if (!state) return null

  const { limit, used, left } = state
  const spent = left === 0

  if (limit > 6) {
    return (
      <span
        className={cn(
          'pointer-events-none absolute inset-x-0 bottom-0 truncate text-center font-mono text-[9px] leading-tight',
          faded ? 'text-dim' : spent ? 'text-missed' : 'text-muted',
        )}
      >
        {left} left
      </span>
    )
  }

  return (
    <span className="pointer-events-none absolute inset-x-0 bottom-[2px] flex justify-center gap-[2px]">
      {Array.from({ length: limit }, (_, i) => (
        <span
          key={i}
          className={cn(
            'h-[3px] w-[3px] rounded-full border',
            i < used
              ? faded
                ? 'border-dim bg-dim'
                : 'border-missed bg-missed'
              : faded
                ? 'border-dim'
                : 'border-muted',
          )}
        />
      ))}
    </span>
  )
}

/**
 * Dims the part of *one lesson block* that has already happened — `pct` is a
 * fraction of the block's own width, not the day's. Scoped to the block
 * rather than the whole row so the grid lines behind empty time never lose
 * their tint; a block straddling "now" shades only its passed left edge.
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
