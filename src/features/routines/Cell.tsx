import { cn } from '@/lib/cn'
import type { CellState } from './status'

const STYLES: Record<CellState, string> = {
  pending: 'border-brass-dim',
  done: 'border-done bg-done-dim',
  busy: 'border-busy bg-busy-dim',
  missed: 'border-missed bg-missed-dim',
  off: 'border-transparent',
}

const GLYPH: Partial<Record<CellState, string>> = {
  done: '✓',
  busy: '~',
  missed: '✕',
}

export function Cell({ state, onTap }: { state: CellState; onTap: () => void }) {
  if (state === 'off') {
    return (
      <div className="flex h-11 w-12 items-center justify-center">
        <span className="text-dim">–</span>
      </div>
    )
  }

  return (
    <div className="flex h-11 w-12 items-center justify-center">
      <button
        type="button"
        onClick={onTap}
        aria-label={LABEL[state]}
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded border-[1.5px] text-xs leading-none transition-colors',
          STYLES[state],
        )}
      >
        <span className={state === 'done' ? 'text-done' : state === 'busy' ? 'text-busy' : 'text-missed'}>
          {GLYPH[state]}
        </span>
      </button>
    </div>
  )
}

const LABEL: Record<Exclude<CellState, 'off'>, string> = {
  pending: 'nezaškrtnuto',
  done: 'splněno',
  busy: 'nestihnuto',
  missed: 'nesplněno',
}
