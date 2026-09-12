import { useEffect, useState } from 'react'
import type { Lesson } from '@/db/db'
import { cn } from '@/lib/cn'
import { DAY_LABELS, type WeekdayIndex } from '@/lib/date'
import { minutesToTime, timeToMinutes } from '@/lib/time'
import { DAY_END, DAYS, DAY_START } from './layout'

export interface LessonDraft {
  name: string
  room: string
  day: WeekdayIndex
  start: string
  end: string
}

export function LessonEditor({
  lesson,
  defaults,
  onSave,
  onDelete,
  onClose,
}: {
  /** existing lesson to edit, or null for a new one */
  lesson: Lesson | null
  /** day + start to prefill a new lesson with (the slot that was tapped) */
  defaults: { day: WeekdayIndex; start: string }
  onSave: (draft: LessonDraft) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [room, setRoom] = useState('')
  const [day, setDay] = useState<WeekdayIndex>(0)
  const [start, setStart] = useState('08:00')
  const [end, setEnd] = useState('09:00')

  useEffect(() => {
    setName(lesson?.name ?? '')
    setRoom(lesson?.room ?? '')
    setDay(lesson?.day ?? defaults.day)
    setStart(lesson?.start ?? defaults.start)
    setEnd(lesson?.end ?? minutesToTime(Math.min(timeToMinutes(defaults.start) + 60, DAY_END)))
  }, [lesson, defaults])

  const startMin = timeToMinutes(start)
  const endMin = timeToMinutes(end)
  const outOfWindow = startMin < DAY_START || endMin > DAY_END
  const badRange = endMin <= startMin
  const valid = Boolean(name.trim()) && !badRange && !outOfWindow

  function submit() {
    if (!valid) return
    onSave({ name: name.trim(), room: room.trim(), day, start, end })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div
        className="mx-auto w-full max-w-2xl rounded-t-2xl border-t border-line bg-panel p-4"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        <h2 className="mb-3 font-display text-lg">{lesson ? 'Edit lesson' : 'New lesson'}</h2>

        <div className="mb-3 flex gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted">Subject</label>
            <input
              autoFocus={!lesson}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="e.g. Maths"
              className="w-full rounded-md border border-line bg-panel-2 px-3 py-2 text-sm outline-none focus:border-muted"
            />
          </div>
          <div className="w-24">
            <label className="mb-1 block text-xs text-muted">Room</label>
            <input
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="B12"
              className="w-full rounded-md border border-line bg-panel-2 px-3 py-2 text-sm outline-none focus:border-muted"
            />
          </div>
        </div>

        <label className="mb-1.5 block text-xs text-muted">Day</label>
        <div className="mb-3 flex gap-1.5">
          {DAYS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDay(d)}
              className={cn(
                'h-9 flex-1 rounded-md border text-xs transition-colors',
                day === d
                  ? 'border-brass-dim bg-brass-dim/30 text-parchment'
                  : 'border-line text-dim',
              )}
            >
              {DAY_LABELS[d]}
            </button>
          ))}
        </div>

        <div className="mb-1 flex gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted">From</label>
            <input
              type="time"
              value={start}
              step={300}
              onChange={(e) => setStart(e.target.value)}
              className="w-full rounded-md border border-line bg-panel-2 px-3 py-2 font-mono text-sm outline-none focus:border-muted"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted">To</label>
            <input
              type="time"
              value={end}
              step={300}
              onChange={(e) => setEnd(e.target.value)}
              className="w-full rounded-md border border-line bg-panel-2 px-3 py-2 font-mono text-sm outline-none focus:border-muted"
            />
          </div>
        </div>
        <p className="mb-3 h-4 text-[11px] text-missed">
          {badRange
            ? 'The end has to come after the start.'
            : outOfWindow
              ? `The timetable only covers ${minutesToTime(DAY_START)}–${minutesToTime(DAY_END)}.`
              : ''}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={!valid}
            className="flex-1 rounded-md border border-brass-dim bg-brass-dim/30 py-2 text-sm text-parchment disabled:opacity-40"
          >
            Save
          </button>
          {lesson && (
            <button
              type="button"
              onClick={() => {
                if (confirm(`Delete "${lesson.name}"?`)) onDelete()
              }}
              className="rounded-md border border-missed-dim px-3 py-2 text-sm text-missed"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
