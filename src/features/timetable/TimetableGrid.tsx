import type { MouseEvent } from 'react'
import { useMemo } from 'react'
import type { Lesson } from '@/db/db'
import { cn } from '@/lib/cn'
import { DAY_LABELS, type WeekdayIndex } from '@/lib/date'
import { DAYS, GRID_HEIGHT, HOURS, PX_PER_MIN, DAY_START, hourAt, placeWeek } from './layout'

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

  function slotTap(day: WeekdayIndex, e: MouseEvent<HTMLButtonElement>) {
    const { top } = e.currentTarget.getBoundingClientRect()
    onTapSlot(day, hourAt(e.clientY - top))
  }

  return (
    <div className="px-4 pb-2">
      <div className="flex pl-9">
        {DAYS.map((d) => (
          <div key={d} className="flex-1 pb-1 text-center text-[11px] text-muted">
            {DAY_LABELS[d]}
          </div>
        ))}
      </div>

      <div className="flex">
        <div className="relative w-9 shrink-0" style={{ height: GRID_HEIGHT }}>
          {HOURS.map((h) => (
            <span
              key={h}
              className="absolute right-1.5 -translate-y-1/2 font-mono text-[10px] text-dim"
              style={{ top: (h * 60 - DAY_START) * PX_PER_MIN }}
            >
              {h}
            </span>
          ))}
        </div>

        <div
          className="relative flex-1 overflow-hidden rounded-md border border-line-soft bg-panel"
          style={{ height: GRID_HEIGHT }}
        >
          {HOURS.slice(1, -1).map((h) => (
            <div
              key={h}
              className="absolute inset-x-0 border-t border-line-soft"
              style={{ top: (h * 60 - DAY_START) * PX_PER_MIN }}
            />
          ))}

          <div className="absolute inset-0 flex">
            {DAYS.map((d) => (
              <div key={d} className={cn('relative flex-1', d > 0 && 'border-l border-line-soft')}>
                <button
                  type="button"
                  className="absolute inset-0 h-full w-full"
                  onClick={(e) => slotTap(d, e)}
                  aria-label={`Add a lesson on ${DAY_LABELS[d]}`}
                />
                {byDay[d].map(({ lesson, top, height, left, width }) => (
                  <button
                    key={lesson.id}
                    type="button"
                    onClick={() => onTapLesson(lesson)}
                    style={{ top, height, left, width }}
                    className="absolute overflow-hidden rounded border-[1.5px] border-brass-dim bg-brass-dim/25 px-1 py-0.5 text-left"
                  >
                    <span className="block truncate text-[11px] leading-tight text-parchment">
                      {lesson.name}
                    </span>
                    {lesson.room && (
                      <span className="block truncate font-mono text-[9px] leading-tight text-muted">
                        {lesson.room}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
