import { useEffect, useState, type ReactNode } from 'react'
import type { Routine } from '@/db/db'
import { cn } from '@/lib/cn'
import { DAY_LABELS, type WeekdayIndex, type WeekParity } from '@/lib/date'

export interface RoutineDraft {
  name: string
  emoji: string
  activeDays: WeekdayIndex[]
  /** null = bound to `activeDays`; a number = that many marks a week, any day */
  timesPerWeek: number | null
  /** null = every week */
  weeks: WeekParity | null
}

const ALL_DAYS: WeekdayIndex[] = [0, 1, 2, 3, 4, 5, 6]
const COUNTS = [1, 2, 3, 4, 5, 6, 7]

/** "Every week" plus the two parities, in the order the picker shows them. */
const WEEK_OPTIONS: { value: WeekParity | null; label: string }[] = [
  { value: null, label: 'Every week' },
  { value: 'odd', label: 'Odd' },
  { value: 'even', label: 'Even' },
]

export function RoutineEditor({
  routine,
  onSave,
  onDelete,
  onClose,
}: {
  /** existing routine to edit, or null for a new one */
  routine: Routine | null
  onSave: (draft: RoutineDraft) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('')
  const [activeDays, setActiveDays] = useState<WeekdayIndex[]>(ALL_DAYS)
  const [timesPerWeek, setTimesPerWeek] = useState<number | null>(null)
  const [weeks, setWeeks] = useState<WeekParity | null>(null)

  useEffect(() => {
    setName(routine?.name ?? '')
    setEmoji(routine?.emoji ?? '')
    setActiveDays(routine?.activeDays ?? ALL_DAYS)
    setTimesPerWeek(routine?.timesPerWeek ?? null)
    setWeeks(routine?.weeks ?? null)
  }, [routine])

  function toggleDay(d: WeekdayIndex) {
    setActiveDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b),
    )
  }

  function submit() {
    const trimmed = name.trim()
    if (!trimmed) return
    onSave({ name: trimmed, emoji: emoji.trim(), activeDays, timesPerWeek, weeks })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div
        className="mx-auto w-full max-w-2xl rounded-t-2xl border-t border-line bg-panel p-4"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        <h2 className="mb-3 font-display text-lg">{routine ? 'Edit routine' : 'New routine'}</h2>

        <div className="mb-3 flex gap-2">
          <div>
            <label className="mb-1 block text-xs text-muted">Emoji</label>
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="🏃"
              className="w-14 rounded-md border border-line bg-panel-2 px-3 py-2 text-center text-base outline-none focus:border-muted"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted">Name</label>
            <input
              autoFocus={!routine}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="e.g. Morning run"
              className="w-full rounded-md border border-line bg-panel-2 px-3 py-2 text-sm outline-none focus:border-muted"
            />
          </div>
        </div>

        <label className="mb-1.5 block text-xs text-muted">Schedule</label>
        <div className="mb-3 flex gap-1.5">
          <Choice active={timesPerWeek === null} onClick={() => setTimesPerWeek(null)}>
            Set days
          </Choice>
          <Choice active={timesPerWeek !== null} onClick={() => setTimesPerWeek(3)}>
            Times a week
          </Choice>
        </div>

        {timesPerWeek === null ? (
          <>
            <label className="mb-1.5 block text-xs text-muted">Active on</label>
            <div className="mb-3 flex gap-1.5">
              {ALL_DAYS.map((d) => (
                <Choice key={d} active={activeDays.includes(d)} onClick={() => toggleDay(d)}>
                  {DAY_LABELS[d]}
                </Choice>
              ))}
            </div>
          </>
        ) : (
          <>
            <label className="mb-1.5 block text-xs text-muted">
              How many times a week — any day counts
            </label>
            <div className="mb-3 flex gap-1.5">
              {COUNTS.map((n) => (
                <Choice key={n} active={timesPerWeek === n} onClick={() => setTimesPerWeek(n)}>
                  {n}×
                </Choice>
              ))}
            </div>
          </>
        )}

        <label className="mb-1.5 block text-xs text-muted">Repeats</label>
        <div className="mb-4 flex gap-1.5">
          {WEEK_OPTIONS.map((o) => (
            <Choice key={o.label} active={weeks === o.value} onClick={() => setWeeks(o.value)}>
              {o.label}
            </Choice>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={!name.trim()}
            className="flex-1 rounded-md border border-brass-dim bg-brass-dim/30 py-2 text-sm text-parchment disabled:opacity-40"
          >
            Save
          </button>
          {routine && (
            <button
              type="button"
              onClick={() => {
                if (confirm(`Delete "${routine.name}"? Its marks will be deleted too.`)) onDelete()
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

/** One option in a row of segmented buttons. */
function Choice({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-9 flex-1 rounded-md border text-xs transition-colors',
        active ? 'border-brass-dim bg-brass-dim/30 text-parchment' : 'border-line text-dim',
      )}
    >
      {children}
    </button>
  )
}
