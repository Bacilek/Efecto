import { db, type Lesson } from '@/db/db'
import { cn } from '@/lib/cn'
import { formatShort, fromISODate } from '@/lib/date'
import { timeToMinutes } from '@/lib/time'
import {
  coverOn,
  coverPatch,
  isFromEarlierWeek,
  type LessonOccurrence,
} from '@/features/timetable/cover'
import { KIND_LABELS } from '@/features/timetable/layout'
import { semesterWeek } from '@/features/timetable/semester'

/**
 * Today's classes from the timetable, at the top of the Today tab, plus any
 * earlier lecture or lab nobody covered yet — it carries over exactly like a
 * planned todo (a tracked seminar never shows up here once its day has
 * passed; see `pendingSeminarAbsences`). One tap ticks it off, seen any way —
 * ticked classes sink below the open ones, like ticked todos. An open class
 * carried over from an earlier week wears its date in red — see
 * `isFromEarlierWeek`.
 */
export function ClassList({
  occurrences,
  today,
}: {
  occurrences: LessonOccurrence[]
  today: string
}) {
  const sorted = [...occurrences].sort((a, b) => {
    const doneA = Number(coverOn(a.lesson, a.date))
    const doneB = Number(coverOn(b.lesson, b.date))
    if (doneA !== doneB) return doneA - doneB
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    const nameCmp = a.lesson.name.localeCompare(b.lesson.name)
    if (nameCmp !== 0) return nameCmp
    const kindCmp = KIND_ORDER[a.lesson.kind] - KIND_ORDER[b.lesson.kind]
    if (kindCmp !== 0) return kindCmp
    return timeToMinutes(a.lesson.start) - timeToMinutes(b.lesson.start)
  })

  async function toggle(lesson: Lesson, date: string, covered: boolean) {
    await db.lessons.update(lesson.id, coverPatch(lesson, date, covered))
  }

  return (
    <section className="px-4 pb-2">
      <h2 className="pb-1 text-[11px] uppercase tracking-wider text-muted">Classes</h2>
      <ul className="rounded-md border border-line-soft">
        {sorted.map(({ lesson: l, date }) => {
          const cover = coverOn(l, date)
          const week = semesterWeek(fromISODate(date))
          // A ticked class is finished, so its age stops mattering.
          const stale = !cover && isFromEarlierWeek(date, today)
          return (
            <li key={`${l.id}|${date}`} className="border-b border-line-soft last:border-b-0">
              <button
                type="button"
                onClick={() => void toggle(l, date, !cover)}
                className="flex w-full items-center gap-1 pr-2 text-left text-sm"
              >
                <span className="flex h-10 w-9 shrink-0 items-center justify-center">
                  <span
                    className={cn(
                      'flex h-5 w-5 items-center justify-center rounded border-[1.5px] text-xs',
                      cover ? 'border-done bg-done-dim text-parchment' : 'border-brass-dim',
                    )}
                  >
                    {cover && '✓'}
                  </span>
                </span>
                <span className="min-w-0 flex-1 py-2">
                  <span
                    className={cn(
                      'flex items-baseline gap-1',
                      cover ? 'text-dim line-through' : 'text-parchment',
                    )}
                  >
                    <span className="truncate">{l.name}</span>
                    <span className={cn('shrink-0 font-mono text-xs', KIND_TEXT[l.kind])}>
                      #{KIND_LABELS[l.kind]}
                      {week ?? ''}
                    </span>
                    <span className={cn('shrink-0 text-xs', stale ? 'text-missed' : 'text-muted')}>
                      ({formatShort(fromISODate(date))})
                    </span>
                  </span>
                  {l.absentDates?.includes(date) && (
                    <span className="mt-0.5 block text-xs text-missed">marked absent</span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

const KIND_TEXT: Record<Lesson['kind'], string> = {
  lecture: 'text-lecture',
  seminar: 'text-seminar',
  lab: 'text-lab',
}

/** Lectures before seminars before labs, once the date and name already agree. */
const KIND_ORDER: Record<Lesson['kind'], number> = {
  lecture: 0,
  seminar: 1,
  lab: 2,
}
