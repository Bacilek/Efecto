import { useRef, useState } from 'react'
import type { Entry, Routine } from '@/db/db'
import { entryId } from '@/db/db'
import { cn } from '@/lib/cn'
import { DAY_LABELS, formatShort, isSameDay, toISODate, todayISO } from '@/lib/date'
import { Cell } from './Cell'
import { dayCompletion } from './stats'
import { resolveCellState } from './status'

type Dnd = { id: string; overId: string; before: boolean }

export function RoutineGrid({
  dates,
  routines,
  entries,
  onTapCell,
  onEditRoutine,
  onReorder,
}: {
  dates: Date[]
  routines: Routine[]
  entries: Map<string, Entry>
  onTapCell: (routine: Routine, dateISO: string) => void
  onEditRoutine: (routine: Routine) => void
  /** new routine id order after a drag; identical order means "no change" */
  onReorder: (ids: string[]) => void
}) {
  const now = new Date()
  const today = todayISO()

  // Column drag-to-reorder. Pointer-based so it works on touch; `touch-pan-y` on
  // the header buttons keeps a horizontal drag as ours (vertical scroll still works).
  const thRefs = useRef(new Map<string, HTMLTableCellElement>())
  const dragRef = useRef<{ id: string; startX: number; dragging: boolean } | null>(null)
  const dndRef = useRef<Dnd | null>(null)
  const didDragRef = useRef(false)
  const [dnd, setDnd] = useState<Dnd | null>(null)

  function setDndState(next: Dnd | null) {
    dndRef.current = next
    setDnd(next)
  }

  function onPointerDown(e: React.PointerEvent, r: Routine) {
    if (routines.length < 2) return
    dragRef.current = { id: r.id, startX: e.clientX, dragging: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current
    if (!d) return
    if (!d.dragging && Math.abs(e.clientX - d.startX) < 6) return
    d.dragging = true
    didDragRef.current = true
    e.preventDefault()

    let over: Dnd = { id: d.id, overId: d.id, before: false }
    for (const [id, el] of thRefs.current) {
      const rect = el.getBoundingClientRect()
      if (e.clientX >= rect.left && e.clientX <= rect.right) {
        over = { id: d.id, overId: id, before: e.clientX < rect.left + rect.width / 2 }
        break
      }
    }
    setDndState(over)
  }

  function endDrag() {
    const d = dragRef.current
    const target = dndRef.current
    dragRef.current = null
    setDndState(null)
    if (d?.dragging && target) commitReorder(d.id, target)
  }

  function commitReorder(id: string, { overId, before }: Dnd) {
    if (overId === id) return
    const ids = routines.map((r) => r.id)
    ids.splice(ids.indexOf(id), 1)
    let to = ids.indexOf(overId)
    if (!before) to += 1
    ids.splice(to, 0, id)
    onReorder(ids)
  }

  return (
    <div className="overflow-x-auto no-scrollbar">
      <table className="border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="sticky left-0 z-20 bg-ink" />
            {routines.map((r) => (
              <th
                key={r.id}
                ref={(el) => {
                  if (el) thRefs.current.set(r.id, el)
                  else thRefs.current.delete(r.id)
                }}
                className="relative bg-ink p-0"
              >
                {dnd?.overId === r.id && dnd.id !== r.id && (
                  <span
                    className={cn(
                      'pointer-events-none absolute inset-y-0 z-30 w-0.5 bg-brass',
                      dnd.before ? 'left-0' : 'right-0',
                    )}
                  />
                )}
                <button
                  type="button"
                  onPointerDown={(e) => onPointerDown(e, r)}
                  onPointerMove={onPointerMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  onClick={() => {
                    if (didDragRef.current) {
                      didDragRef.current = false
                      return
                    }
                    onEditRoutine(r)
                  }}
                  className={cn(
                    'flex h-16 w-12 touch-pan-y select-none flex-col items-center justify-end pb-1.5 transition-opacity',
                    dnd?.id === r.id && 'opacity-30',
                  )}
                  title={r.name}
                  aria-label={r.name}
                >
                  {r.emoji ? (
                    <span className="text-xl leading-none">{r.emoji}</span>
                  ) : (
                    <span className="max-h-14 w-4 rotate-180 truncate text-[11px] leading-tight text-muted [writing-mode:vertical-rl]">
                      {r.name}
                    </span>
                  )}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dates.map((date, i) => {
            const isToday = isSameDay(date, now)
            const dISO = toISODate(date)
            const day = dayCompletion(routines, date, entries, today)
            return (
              <tr key={dISO}>
                <th
                  scope="row"
                  className={cn(
                    'sticky left-0 z-10 border-t border-line-soft px-3 text-left align-middle',
                    isToday ? 'bg-today' : 'bg-ink',
                  )}
                >
                  <div className="whitespace-nowrap">
                    <span
                      className={cn('text-[13px]', isToday ? 'text-brass' : 'text-parchment')}
                    >
                      {DAY_LABELS[i]}
                    </span>{' '}
                    <span className="font-mono text-[11px] text-muted">{formatShort(date)}</span>
                  </div>
                  <div className="font-mono text-[10px] text-dim">
                    {day.total ? `${day.pct} %` : '–'}
                  </div>
                </th>
                {routines.map((r) => {
                  const entry = entries.get(entryId(r.id, dISO))
                  const state = resolveCellState(r, date, entry, today)
                  return (
                    <td
                      key={r.id}
                      className={cn('border-t border-line-soft p-0', isToday && 'bg-today')}
                    >
                      <Cell state={state} onTap={() => onTapCell(r, dISO)} />
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
