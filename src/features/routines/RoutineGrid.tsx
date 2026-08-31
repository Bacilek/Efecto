import { useEffect, useMemo, useRef, useState } from 'react'
import type { Entry, Routine } from '@/db/db'
import { entryId } from '@/db/db'
import { cn } from '@/lib/cn'
import { DAY_LABELS, formatShort, isSameDay, toISODate, todayISO } from '@/lib/date'
import { Cell } from './Cell'
import { dayCompletion } from './stats'
import { resolveCellState } from './status'

type DragState = { id: string; dx: number; from: number; to: number; w: number }

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const copy = arr.slice()
  copy.splice(to, 0, copy.splice(from, 1)[0])
  return copy
}

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
  /** new routine id order after a drag */
  onReorder: (ids: string[]) => void
}) {
  const now = new Date()
  const today = todayISO()

  // Column drag-to-reorder. The grabbed header follows the pointer 1:1; the other
  // columns slide to their new slots live (via `visualRoutines`) while dragging.
  // Pointer-based so it works on touch; `touch-pan-y` keeps vertical scroll.
  const grabRef = useRef<{ id: string; startX: number; from: number; w: number; moved: boolean } | null>(null)
  const dragStateRef = useRef<DragState | null>(null)
  const settleRef = useRef<string | null>(null)
  const didDragRef = useRef(false)
  const [drag, setDragRaw] = useState<DragState | null>(null)

  function setDrag(next: DragState | null) {
    dragStateRef.current = next
    setDragRaw(next)
  }

  const visualRoutines = useMemo(
    () => (drag && drag.from !== drag.to ? arrayMove(routines, drag.from, drag.to) : routines),
    [routines, drag],
  )

  // Once the persisted order matches the drop target, drop the drag overlay.
  useEffect(() => {
    if (settleRef.current && routines.map((r) => r.id).join('|') === settleRef.current) {
      settleRef.current = null
      dragStateRef.current = null
      setDragRaw(null)
    }
  }, [routines])

  function onPointerDown(e: React.PointerEvent, r: Routine) {
    if (routines.length < 2) return
    const rect = e.currentTarget.getBoundingClientRect()
    grabRef.current = {
      id: r.id,
      startX: e.clientX,
      from: routines.findIndex((x) => x.id === r.id),
      w: rect.width || 48,
      moved: false,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    const g = grabRef.current
    if (!g) return
    const dx = e.clientX - g.startX
    if (!g.moved && Math.abs(dx) < 6) return
    g.moved = true
    didDragRef.current = true
    e.preventDefault()
    const shift = Math.round(dx / g.w)
    const to = Math.max(0, Math.min(routines.length - 1, g.from + shift))
    setDrag({ id: g.id, dx, from: g.from, to, w: g.w })
  }

  function endDrag() {
    const g = grabRef.current
    grabRef.current = null
    const cur = dragStateRef.current
    if (!g?.moved || !cur || cur.to === cur.from) {
      setDrag(null)
      return
    }
    const ids = arrayMove(routines, cur.from, cur.to).map((r) => r.id)
    settleRef.current = ids.join('|')
    // hold the reordered view; the grabbed icon rests in its new slot
    setDrag({ ...cur, dx: (cur.to - cur.from) * cur.w })
    onReorder(ids)
    // safety net if the persisted order never comes back as expected
    window.setTimeout(() => {
      if (settleRef.current === ids.join('|')) {
        settleRef.current = null
        setDrag(null)
      }
    }, 400)
  }

  return (
    <div className="overflow-x-auto no-scrollbar">
      <table className="border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="sticky left-0 z-20 bg-ink" />
            {visualRoutines.map((r) => (
              <th key={r.id} className="bg-ink p-0">
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
                  style={
                    drag?.id === r.id
                      ? {
                          transform: `translateX(${drag.dx - (drag.to - drag.from) * drag.w}px)`,
                          position: 'relative',
                          zIndex: 40,
                        }
                      : undefined
                  }
                  className="flex h-16 w-12 touch-pan-y select-none flex-col items-center justify-end pb-1.5"
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
                {visualRoutines.map((r) => {
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
