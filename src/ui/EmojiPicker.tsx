import { useEffect, useMemo, useState } from 'react'

/** Cap on rendered results — keeps the grid light even on an empty query. */
const MAX_RESULTS = 150

/**
 * Search-by-name emoji picker, shown inline below the field that opened it —
 * the app has no other floating popovers, so this doesn't either. Typing
 * filters ~1900 emoji by their English name (`emojiData.ts`); tapping one
 * calls `onPick`. The name data is dynamically imported so browsing emoji
 * only costs something the first time someone actually opens this.
 */
export function EmojiPickerPanel({
  onPick,
  onClose,
}: {
  onPick: (emoji: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [names, setNames] = useState<readonly (readonly [string, string])[] | null>(null)

  useEffect(() => {
    let cancelled = false
    void import('./emojiData').then((m) => {
      if (!cancelled) setNames(m.EMOJI_NAMES)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const results = useMemo(() => {
    if (!names) return []
    const q = query.trim().toLowerCase()
    return q ? names.filter(([, name]) => name.includes(q)) : names
  }, [names, query])
  const shown = results.slice(0, MAX_RESULTS)

  return (
    <div className="mb-3 rounded-md border border-line bg-panel-2 p-2">
      <div className="mb-2 flex items-center gap-2">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search emoji, e.g. book, game, run…"
          className="min-w-0 flex-1 rounded-md border border-line bg-panel px-2.5 py-1.5 text-sm outline-none focus:border-muted"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close emoji search"
          className="shrink-0 rounded-md border border-line px-2 py-1.5 text-xs text-muted hover:border-muted"
        >
          ✕
        </button>
      </div>

      {!names ? (
        <p className="py-3 text-center text-xs text-dim">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="py-3 text-center text-xs text-dim">No emoji match "{query}".</p>
      ) : (
        <div className="grid max-h-48 grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-1 overflow-y-auto">
          {shown.map(([emoji, name]) => (
            <button
              key={emoji}
              type="button"
              title={name}
              onClick={() => onPick(emoji)}
              className="flex aspect-square items-center justify-center rounded text-xl hover:bg-panel"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      {results.length > MAX_RESULTS && (
        <p className="pt-1 text-center text-[10px] text-dim">
          {results.length - MAX_RESULTS} more — keep typing to narrow it down
        </p>
      )}
    </div>
  )
}
