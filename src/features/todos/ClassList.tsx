import { useState } from 'react'
import { db, type Lesson, type LessonCover } from '@/db/db'
import { cn } from '@/lib/cn'
import { CameraIcon } from '@/ui/CameraIcon'
import { COVERS, COVER_LABELS, coverOn, coverPatch } from '@/features/timetable/cover'
import { KIND_LABELS } from '@/features/timetable/layout'

/**
 * Today's classes from the timetable, at the top of the Today tab. Each one is
 * ticked off by saying *how* it was covered — tapping the box opens the four
 * choices underneath, tapping a ticked box clears it. Ticked classes sink below
 * the open ones, like ticked todos.
 */
export function ClassList({ lessons, today }: { lessons: Lesson[]; today: string }) {
  const [picking, setPicking] = useState<string | null>(null)

  const sorted = [...lessons].sort(
    (a, b) => Number(!!coverOn(a, today)) - Number(!!coverOn(b, today)),
  )

  async function setCover(lesson: Lesson, cover: LessonCover | null) {
    setPicking(null)
    await db.lessons.update(lesson.id, coverPatch(lesson, today, cover))
  }

  return (
    <section className="px-4 pb-2">
      <h2 className="pb-1 text-[11px] uppercase tracking-wider text-muted">Classes</h2>
      <ul className="rounded-md border border-line-soft">
        {sorted.map((l) => {
          const cover = coverOn(l, today)
          const open = picking === l.id
          return (
            <li key={l.id} className="border-b border-line-soft last:border-b-0">
              <div className="flex items-start gap-1">
                <button
                  type="button"
                  onClick={() => (cover ? void setCover(l, null) : setPicking(open ? null : l.id))}
                  aria-label={cover ? 'Mark as not done' : 'Mark as done'}
                  aria-expanded={open}
                  className="flex h-12 w-9 shrink-0 items-center justify-center"
                >
                  <span
                    className={cn(
                      'flex h-5 w-5 items-center justify-center rounded border-[1.5px] text-xs',
                      cover
                        ? 'border-done bg-done-dim text-parchment'
                        : open
                          ? 'border-brass bg-brass-dim/30'
                          : 'border-brass-dim',
                    )}
                  >
                    {cover && '✓'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => !cover && setPicking(open ? null : l.id)}
                  className="min-w-0 flex-1 py-3 pr-2 text-left text-sm"
                >
                  <span
                    className={cn(
                      'flex items-center gap-1.5',
                      cover ? 'text-dim line-through' : 'text-parchment',
                    )}
                  >
                    <span className="truncate">
                      {l.name}
                      {l.group ? `/${l.group}` : ''}
                    </span>
                    <span className={cn('font-mono text-[10px]', KIND_TEXT[l.kind])}>
                      {KIND_LABELS[l.kind]}
                    </span>
                    {l.recorded && <CameraIcon className="shrink-0 text-muted" />}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xs text-muted">
                    <span className="font-mono">
                      {l.start}–{l.end}
                    </span>
                    {l.room && <span>{l.room}</span>}
                    {cover && <span className="text-done">{COVER_LABELS[cover]}</span>}
                    {!cover && l.absentDates?.includes(today) && (
                      <span className="text-missed">marked absent</span>
                    )}
                  </span>
                </button>
              </div>
              {open && (
                <div className="flex flex-wrap gap-1.5 px-2 pb-3 pl-10">
                  {COVERS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => void setCover(l, c)}
                      className="rounded-md border border-line px-2.5 py-1 text-xs text-parchment transition-colors hover:border-done"
                    >
                      {COVER_LABELS[c]}
                    </button>
                  ))}
                </div>
              )}
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
