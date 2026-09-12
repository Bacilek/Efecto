import { useEffect, useState } from 'react'
import type { TodoFolder } from '@/db/db'

export interface FolderDraft {
  name: string
  emoji: string
}

export function FolderEditor({
  folder,
  todoCount,
  onSave,
  onDelete,
  onClose,
}: {
  /** existing folder to edit, or null for a new one */
  folder: TodoFolder | null
  /** how many todos deleting it would take with it */
  todoCount: number
  onSave: (draft: FolderDraft) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('')

  useEffect(() => {
    setName(folder?.name ?? '')
    setEmoji(folder?.emoji ?? '')
  }, [folder])

  function submit() {
    const trimmed = name.trim()
    if (!trimmed) return
    onSave({ name: trimmed, emoji: emoji.trim() })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div
        className="mx-auto w-full max-w-2xl rounded-t-2xl border-t border-line bg-panel p-4"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        <h2 className="mb-3 font-display text-lg">{folder ? 'Edit folder' : 'New folder'}</h2>

        <div className="mb-4 flex gap-2">
          <div>
            <label className="mb-1 block text-xs text-muted">Emoji</label>
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="📚"
              className="w-14 rounded-md border border-line bg-panel-2 px-3 py-2 text-center text-base outline-none focus:border-muted"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted">Name</label>
            <input
              autoFocus={!folder}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="e.g. School"
              className="w-full rounded-md border border-line bg-panel-2 px-3 py-2 text-sm outline-none focus:border-muted"
            />
          </div>
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
          {folder && (
            <button
              type="button"
              onClick={() => {
                const tail = todoCount
                  ? ` and its ${todoCount} todo${todoCount > 1 ? 's' : ''}`
                  : ''
                if (confirm(`Delete "${folder.name}"${tail}?`)) onDelete()
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
