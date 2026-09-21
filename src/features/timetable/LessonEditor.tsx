import { useEffect, useState, type ReactNode } from 'react'
import type { Lesson, LessonKind } from '@/db/db'
import { cn } from '@/lib/cn'
import {
  DAY_LABELS,
  formatShort,
  fromISODate,
  type WeekdayIndex,
  type WeekParity,
} from '@/lib/date'
import { minutesToTime, timeToMinutes } from '@/lib/time'
import { CameraIcon } from '@/ui/CameraIcon'
import { coverOn } from './cover'
import { happensOn } from './occurrence'
import { absenceState, wasAbsent } from './absence'
import { DAY_END, DAYS, DAY_START, KINDS, KIND_LABELS, KIND_STYLES } from './layout'

export interface LessonDraft {
  name: string
  kind: LessonKind
  group: string
  room: string
  day: WeekdayIndex
  start: string
  end: string
  /** null = every week */
  weeks: WeekParity | null
  /** recorded → no need to be there in person */
  recorded: boolean
  /** excused absences the subject allows per semester; 0 = not tracked */
  absenceLimit: number
}

/** "Every week" plus the two parities, in the order the picker shows them. */
const WEEK_OPTIONS: { value: WeekParity | null; label: string }[] = [
  { value: null, label: 'Every week' },
  { value: 'odd', label: 'Odd' },
  { value: 'even', label: 'Even' },
]

export function LessonEditor({
  lesson,
  defaults,
  occurrenceDate,
  occurrenceParity,
  onSave,
  onToggleAbsence,
  onToggleOccurrence,
  onToggleCover,
  onDelete,
  onClose,
}: {
  /** existing lesson to edit, or null for a new one */
  lesson: Lesson | null
  /** day + start to prefill a new lesson with (the slot that was tapped) */
  defaults: { day: WeekdayIndex; start: string }
  /** the date of the occurrence that was tapped (`YYYY-MM-DD`) */
  occurrenceDate: string | null
  /** parity of the week that date is in, for resolving odd/even-only lessons */
  occurrenceParity: WeekParity | null
  onSave: (draft: LessonDraft) => void
  /** record or take back an absence on `occurrenceDate` */
  onToggleAbsence: () => void
  /** cancel or restore just `occurrenceDate` */
  onToggleOccurrence: () => void
  /** mark `occurrenceDate` covered or not, the same flag Today's checkbox sets */
  onToggleCover: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<LessonKind>('lecture')
  const [group, setGroup] = useState('')
  const [room, setRoom] = useState('')
  const [recorded, setRecorded] = useState(false)
  const [absenceLimit, setAbsenceLimit] = useState(0)
  const [day, setDay] = useState<WeekdayIndex>(0)
  const [start, setStart] = useState('08:00')
  const [end, setEnd] = useState('09:00')
  const [weeks, setWeeks] = useState<WeekParity | null>(null)

  useEffect(() => {
    setName(lesson?.name ?? '')
    setKind(lesson?.kind ?? 'lecture')
    setGroup(lesson?.group ?? '')
    setRoom(lesson?.room ?? '')
    setRecorded(lesson?.recorded ?? false)
    setAbsenceLimit(lesson?.absenceLimit ?? 0)
    setDay(lesson?.day ?? defaults.day)
    setWeeks(lesson?.weeks ?? null)
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
    onSave({
      name: name.trim(),
      kind,
      group: group.trim(),
      room: room.trim(),
      day,
      start,
      end,
      weeks,
      recorded,
      absenceLimit,
    })
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
            <label className="mb-1 block text-xs text-muted">Subject code</label>
            <input
              autoFocus={!lesson}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="e.g. PV170"
              className="w-full rounded-md border border-line bg-panel-2 px-3 py-2 text-sm outline-none focus:border-muted"
            />
          </div>
          <div className="w-16">
            <label className="mb-1 block text-xs text-muted">Group</label>
            <input
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="09"
              className="w-full rounded-md border border-line bg-panel-2 px-3 py-2 text-sm outline-none focus:border-muted"
            />
          </div>
          <div className="w-24">
            <label className="mb-1 block text-xs text-muted">Room</label>
            <input
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="B204"
              className="w-full rounded-md border border-line bg-panel-2 px-3 py-2 text-sm outline-none focus:border-muted"
            />
          </div>
        </div>

        <label className="mb-1.5 block text-xs text-muted">Type</label>
        <div className="mb-3 flex gap-1.5">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn(
                'h-9 flex-1 rounded-md border text-xs transition-colors',
                kind === k ? `${KIND_STYLES[k]} text-parchment` : 'border-line text-dim',
              )}
            >
              {KIND_LABELS[k]}
            </button>
          ))}
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

        <label className="mb-1.5 block text-xs text-muted">Repeats</label>
        <div className="mb-3 flex gap-1.5">
          {WEEK_OPTIONS.map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setWeeks(o.value)}
              className={cn(
                'h-9 flex-1 rounded-md border text-xs transition-colors',
                weeks === o.value
                  ? 'border-brass-dim bg-brass-dim/30 text-parchment'
                  : 'border-line text-dim',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setRecorded((r) => !r)}
          aria-pressed={recorded}
          className={cn(
            'mb-3 flex h-9 w-full items-center justify-center gap-2 rounded-md border text-xs transition-colors',
            recorded ? 'border-brass-dim bg-brass-dim/30 text-parchment' : 'border-line text-dim',
          )}
        >
          <CameraIcon size={12} />
          Recorded — no need to go
        </button>

        <label className="mb-1.5 block text-xs text-muted">Excused absences a semester</label>
        <div className="mb-3 flex items-center gap-1.5">
          <Stepper
            label="One fewer"
            onClick={() => setAbsenceLimit((n) => Math.max(0, n - 1))}
            disabled={absenceLimit === 0}
          >
            −
          </Stepper>
          <span className="flex-1 text-center font-mono text-sm text-parchment">
            {absenceLimit === 0 ? <span className="text-dim">not tracked</span> : absenceLimit}
          </span>
          <Stepper label="One more" onClick={() => setAbsenceLimit((n) => n + 1)}>
            +
          </Stepper>
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

        {lesson && occurrenceDate && (
          <OccurrenceRow
            lesson={lesson}
            dateISO={occurrenceDate}
            parity={occurrenceParity}
            onToggle={onToggleOccurrence}
            onToggleAbsence={onToggleAbsence}
            onToggleCover={onToggleCover}
          />
        )}

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

/**
 * Cancel or restore the single date that was tapped, leaving every other week
 * alone. Acting on one occurrence is a different thing from editing the weekly
 * lesson, so it writes immediately and closes rather than joining the draft.
 */
function OccurrenceRow({
  lesson,
  dateISO,
  parity,
  onToggle,
  onToggleAbsence,
  onToggleCover,
}: {
  lesson: Lesson
  dateISO: string
  parity: WeekParity | null
  onToggle: () => void
  onToggleAbsence: () => void
  onToggleCover: () => void
}) {
  const happens = happensOn(lesson, dateISO, parity)
  const absences = absenceState(lesson)
  const absent = wasAbsent(lesson, dateISO)
  const covered = coverOn(lesson, dateISO)
  const skipDates = lesson.skipDates ?? []
  const list = (dates: string[]) => dates.map((d) => formatShort(fromISODate(d))).join(', ')

  return (
    <div className="mb-3 rounded-md border border-line-soft bg-panel-2 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-parchment">This week · {formatShort(fromISODate(dateISO))}</p>
          <p className="truncate text-[11px] text-muted">
            {lesson.onlyDates
              ? lesson.onlyDates.length > 0
                ? `Runs only on ${list(lesson.onlyDates)}`
                : 'Runs on no dates'
              : [
                  lesson.weeks ? `${lesson.weeks} weeks only` : 'Every week',
                  skipDates.length > 0 ? `cancelled on ${list(skipDates)}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            'shrink-0 rounded-md border px-2.5 py-1 text-xs transition-colors',
            happens
              ? 'border-missed-dim text-missed hover:border-missed'
              : 'border-line text-muted hover:border-muted',
          )}
        >
          {happens ? 'Cancel this one' : 'Restore this one'}
        </button>
      </div>

      {/* The same flag the Today tab's checkbox sets — reachable here too, so
          an accidental tap (or wanting it back open to tick once actually
          done) has somewhere to be undone, since a covered-and-not-today
          occurrence no longer shows on Today at all. */}
      <div className="mt-2 flex items-center justify-between gap-3 border-t border-line-soft pt-2">
        <p className="min-w-0 text-[11px] text-muted">
          {covered ? 'Marked done on Today' : 'Not yet marked done'}
        </p>
        <button
          type="button"
          onClick={onToggleCover}
          disabled={!happens}
          className={cn(
            'shrink-0 rounded-md border px-2.5 py-1 text-xs transition-colors disabled:opacity-40',
            covered
              ? 'border-line text-muted hover:border-muted'
              : 'border-done-dim text-done hover:border-done',
          )}
        >
          {covered ? 'Not done yet' : 'Mark as done'}
        </button>
      </div>

      {absences && (
        <div className="mt-2 flex items-center justify-between gap-3 border-t border-line-soft pt-2">
          <p className="min-w-0 text-[11px] text-muted">
            <span className={absences.left === 0 ? 'text-missed' : 'text-parchment'}>
              {absences.left} of {absences.limit} left
            </span>
            {absent && ' · missed this one'}
          </p>
          <button
            type="button"
            onClick={onToggleAbsence}
            disabled={!happens}
            className={cn(
              'shrink-0 rounded-md border px-2.5 py-1 text-xs transition-colors disabled:opacity-40',
              absent
                ? 'border-line text-muted hover:border-muted'
                : 'border-missed-dim text-missed hover:border-missed',
            )}
          >
            {absent ? 'I was there' : "I wasn't there"}
          </button>
        </div>
      )}
    </div>
  )
}

/** One side of the absence-allowance stepper. */
function Stepper({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="h-9 w-12 rounded-md border border-line text-sm text-muted transition-colors hover:border-muted disabled:opacity-40"
    >
      {children}
    </button>
  )
}
