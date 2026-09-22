import type { MouseEvent } from 'react'
import { useMemo } from 'react'
import type { Todo } from '@/db/db'
import { cn } from '@/lib/cn'
import { DAY_LABELS, formatShort, weekdayIndex, type WeekdayIndex } from '@/lib/date'
import type { TimeWindow } from '@/lib/timeGrid'
import { useNow } from '@/lib/useNow'
import {
  DAYS,
  GRID_HEIGHT,
  GUTTER,
  HEADER_HEIGHT,
  ROW_HEIGHT,
  elapsedPct,
  hourAt,
  hourPct,
  hoursOf,
  nowMarker,
  pctOfDay,
  placeWeek,
} from './layout'

export function CalendarGrid({
  todos,
  dates,
  win,
  expanded,
  onToggleExpand,
  showNow,
  onTapTodo,
  onTapSlot,
}: {
  todos: Todo[]
  /** that week's Mon–Sun */
  dates: Date[]
  win: TimeWindow
  expanded: boolean
  onToggleExpand: () => void
  /** whether the week on screen is the one we're in — gates the "now" marker */
  showNow: boolean
  onTapTodo: (todo: Todo) => void
  /** empty slot tapped — `startMinutes` is the hour it landed on */
  onTapSlot: (day: WeekdayIndex, startMinutes: number) => void
}) {
  const byDay = useMemo(() => placeWeek(todos, dates, win), [todos, dates, win])
  const now = useNow()
  const marker = showNow ? nowMarker(now, win) : null
  const hours = hoursOf(win)

  function slotTap(day: WeekdayIndex, e: MouseEvent<HTMLButtonElement>) {
    const { left, width } = e.currentTarget.getBoundingClientRect()
    onTapSlot(day, hourAt((e.clientX - left) / width, win))
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
        {/* 00:00–06:00 is rarely used, so it stays out of the default window
            rather than compressing every hour column to fit it. */}
        <button
          type="button"
          onClick={onToggleExpand}
          className="mb-0.5 font-mono text-[10px] text-dim transition-colors hover:text-muted"
        >
          {expanded ? '« hide 00:00–06:00' : '» show 00:00–06:00'}
        </button>

        <div className="relative" style={{ height: HEADER_HEIGHT }}>
          {hours.slice(0, -1).map((h) => (
            <div
              key={h}
              className={cn(
                'absolute bottom-0 top-0 pl-1 text-left font-mono text-[11px] text-muted',
                h > hours[0] && 'border-l border-line-soft',
              )}
              style={{ left: `${pctOfDay(h * 60, win)}%`, width: `${hourPct(win)}%` }}
            >
              {/* Only every other hour is labelled — an hour column is narrow
                  enough on a phone that labelling all of them would overlap. */}
              {(h - hours[0]) % 2 === 0 && `${h}:00`}
            </div>
          ))}
        </div>

        <div
          className="relative overflow-hidden rounded-md border border-line-soft bg-panel"
          // content-box, not Tailwind's global border-box — see TimetableGrid,
          // same reasoning: rows are positioned in pixels against this
          // element's content height, and border-box would clip Sunday's row.
          style={{ height: GRID_HEIGHT, boxSizing: 'content-box' }}
        >
          {showNow && (
            <div
              className="absolute inset-x-0 bg-today"
              style={{ top: weekdayIndex(now) * ROW_HEIGHT, height: ROW_HEIGHT }}
              aria-hidden
            />
          )}

          {hours.slice(1, -1).map((h) => (
            <div
              key={h}
              className="absolute inset-y-0 border-l border-line-soft"
              style={{ left: `${pctOfDay(h * 60, win)}%` }}
            />
          ))}

          {DAYS.map((d, i) => {
            const cut = showNow ? elapsedPct(d, now, win) : 0
            return (
              <div
                key={d}
                className={cn('absolute inset-x-0', i > 0 && 'border-t border-line-soft')}
                style={{ top: i * ROW_HEIGHT, height: ROW_HEIGHT }}
              >
                <button
                  type="button"
                  className="absolute inset-0 h-full w-full"
                  onClick={(e) => slotTap(d, e)}
                  aria-label={`Add a todo on ${DAY_LABELS[d]}`}
                />
                {byDay[d].map(({ todo, left, width, top, height }) => {
                  const elapsed =
                    width > 0 ? Math.min(100, Math.max(0, ((cut - left) / width) * 100)) : 0
                  return (
                    <button
                      key={todo.id}
                      type="button"
                      onClick={() => onTapTodo(todo)}
                      style={{ left: `${left}%`, width: `${width}%`, top, height, minWidth: 22 }}
                      className="absolute flex flex-col justify-center overflow-hidden rounded border-[1.5px] border-brass-dim bg-brass-dim/30 px-0.5 text-center"
                    >
                      <span
                        className={cn(
                          'w-full truncate text-[11px] leading-tight',
                          todo.done ? 'text-dim line-through' : 'text-parchment',
                        )}
                      >
                        {todo.title}
                      </span>
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

/** Dims the part of one todo block that's already behind us — see TimetableGrid's `ElapsedShade`. */
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
