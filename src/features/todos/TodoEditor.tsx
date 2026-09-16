import { useEffect, useState, type ReactNode } from 'react'
import type { Todo, TodoFolder } from '@/db/db'
import { cn } from '@/lib/cn'
import { formatShort, fromISODate, todayISO } from '@/lib/date'

export interface TodoDraft {
  title: string
  note: string
  /** null = "Unsorted" */
  folderId: string | null
  /** `YYYY-MM-DD` it sits on the Today tab under; null = not planned */
  plannedFor: string | null
}

export function TodoEditor({
  todo,
  folders,
  initialFolderId,
  initialPlannedFor,
  onSave,
  onDelete,
  onClose,
}: {
  /** existing todo to edit, or null for a new one */
  todo: Todo | null
  folders: TodoFolder[]
  /** folder a new todo lands in — the one whose "+" was tapped */
  initialFolderId: string | null
  /** set for a todo added from the Today tab, so it lands there */
  initialPlannedFor: string | null
  onSave: (draft: TodoDraft) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [folderId, setFolderId] = useState<string | null>(null)
  const [plannedFor, setPlannedFor] = useState<string | null>(null)

  useEffect(() => {
    setTitle(todo?.title ?? '')
    setNote(todo?.note ?? '')
    setFolderId(todo ? (todo.folderId ?? null) : initialFolderId)
    setPlannedFor(todo ? (todo.plannedFor ?? null) : initialPlannedFor)
  }, [todo, initialFolderId, initialPlannedFor])

  // With a catch-all folder around, "Unsorted" is only worth offering while
  // there are no folders at all, or to a todo that is already sitting there.
  const allowUnsorted = folders.length === 0 || !!(todo && !todo.folderId)

  function submit() {
    const trimmed = title.trim()
    if (!trimmed) return
    onSave({ title: trimmed, note: note.trim(), folderId, plannedFor })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div
        className="mx-auto w-full max-w-2xl rounded-t-2xl border-t border-line bg-panel p-4"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        <h2 className="mb-3 font-display text-lg">{todo ? 'Edit todo' : 'New todo'}</h2>

        <label className="mb-1 block text-xs text-muted">Task</label>
        <input
          autoFocus={!todo}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="e.g. Return the library books"
          className="mb-3 w-full rounded-md border border-line bg-panel-2 px-3 py-2 text-sm outline-none focus:border-muted"
        />

        <label className="mb-1 block text-xs text-muted">Note</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Optional"
          className="mb-3 w-full resize-none rounded-md border border-line bg-panel-2 px-3 py-2 text-sm outline-none focus:border-muted"
        />

        <label className="mb-1.5 block text-xs text-muted">Plan</label>
        <div className="mb-3 flex flex-wrap gap-1.5">
          <Chip active={plannedFor === null} onClick={() => setPlannedFor(null)}>
            Someday
          </Chip>
          <Chip active={plannedFor === todayISO()} onClick={() => setPlannedFor(todayISO())}>
            Today
          </Chip>
          <DateChip value={plannedFor} onChange={setPlannedFor} />
        </div>

        <label className="mb-1.5 block text-xs text-muted">Folder</label>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {allowUnsorted && (
            <Chip active={folderId === null} onClick={() => setFolderId(null)}>
              Unsorted
            </Chip>
          )}
          {folders.map((f) => (
            <Chip key={f.id} active={folderId === f.id} onClick={() => setFolderId(f.id)}>
              {f.emoji ? `${f.emoji} ${f.name}` : f.name}
            </Chip>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={!title.trim()}
            className="flex-1 rounded-md border border-brass-dim bg-brass-dim/30 py-2 text-sm text-parchment disabled:opacity-40"
          >
            Save
          </button>
          {todo && (
            <button
              type="button"
              onClick={() => {
                if (confirm(`Delete "${todo.title}"?`)) onDelete()
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
 * The "on a date" pill: the same chip, with the platform's date picker behind
 * it (a transparent `<input type="date">`), so the sheet never has to draw a
 * calendar of its own. Active — and labelled with the date — for any day that
 * isn't today.
 */
function DateChip({
  value,
  onChange,
}: {
  value: string | null
  onChange: (iso: string | null) => void
}) {
  const dated = value !== null && value !== todayISO()

  return (
    <label
      className={cn(
        'relative flex h-9 items-center rounded-md border px-3 text-xs transition-colors',
        dated ? 'border-brass-dim bg-brass-dim/30 text-parchment' : 'border-line text-dim',
      )}
    >
      {dated ? `🗓︎ ${formatShort(fromISODate(value))}` : '🗓︎ On a date'}
      <input
        type="date"
        value={value ?? ''}
        aria-label="Plan for a date"
        onClick={(e) => {
          const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void }
          try {
            el.showPicker?.()
          } catch {
            /* refused without a gesture — the plain tap still opens it */
          }
        }}
        onChange={(e) => onChange(e.target.value || null)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </label>
  )
}

/** One option in a wrapping row of pickable pills. */
function Chip({
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
        'h-9 rounded-md border px-3 text-xs transition-colors',
        active ? 'border-brass-dim bg-brass-dim/30 text-parchment' : 'border-line text-dim',
      )}
    >
      {children}
    </button>
  )
}
