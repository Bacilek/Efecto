import { useEffect, useState } from 'react'
import type { Routine } from '@/db/db'
import { cn } from '@/lib/cn'
import { DAY_LABELS, type WeekdayIndex } from '@/lib/date'

export interface RoutineDraft {
  name: string
  emoji: string
  time: string
  activeDays: WeekdayIndex[]
}

const ALL_DAYS: WeekdayIndex[] = [0, 1, 2, 3, 4, 5, 6]

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
  const [time, setTime] = useState('')
  const [activeDays, setActiveDays] = useState<WeekdayIndex[]>(ALL_DAYS)

  useEffect(() => {
    setName(routine?.name ?? '')
    setEmoji(routine?.emoji ?? '')
    setTime(routine?.time ?? '')
    setActiveDays(routine?.activeDays ?? ALL_DAYS)
  }, [routine])

  function toggleDay(d: WeekdayIndex) {
    setActiveDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b),
    )
  }

  function submit() {
    const trimmed = name.trim()
    if (!trimmed) return
    onSave({ name: trimmed, emoji: emoji.trim(), time: time.trim(), activeDays })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div
        className="mx-auto w-full max-w-2xl rounded-t-2xl border-t border-line bg-panel p-4"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        <h2 className="mb-3 font-display text-lg">
          {routine ? 'Upravit rutinu' : 'Nová rutina'}
        </h2>

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
            <label className="mb-1 block text-xs text-muted">Název</label>
            <input
              autoFocus={!routine}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="např. Ranní běh"
              className="w-full rounded-md border border-line bg-panel-2 px-3 py-2 text-sm outline-none focus:border-muted"
            />
          </div>
        </div>

        {routine && (
          <>
            <label className="mb-1 block text-xs text-muted">Čas (volitelně)</label>
            <input
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="7:40"
              inputMode="numeric"
              className="mb-3 w-24 rounded-md border border-line bg-panel-2 px-3 py-2 font-mono text-sm outline-none focus:border-muted"
            />
          </>
        )}

        <label className="mb-1.5 block text-xs text-muted">Platí ve dnech</label>
        <div className="mb-4 flex gap-1.5">
          {ALL_DAYS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDay(d)}
              className={cn(
                'h-9 flex-1 rounded-md border text-xs transition-colors',
                activeDays.includes(d)
                  ? 'border-brass-dim bg-brass-dim/30 text-parchment'
                  : 'border-line text-dim',
              )}
            >
              {DAY_LABELS[d]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={!name.trim()}
            className="flex-1 rounded-md border border-brass-dim bg-brass-dim/30 py-2 text-sm text-parchment disabled:opacity-40"
          >
            Uložit
          </button>
          {routine && (
            <button
              type="button"
              onClick={() => {
                if (confirm(`Smazat rutinu „${routine.name}"? Smažou se i její záznamy.`)) onDelete()
              }}
              className="rounded-md border border-missed-dim px-3 py-2 text-sm text-missed"
            >
              Smazat
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
