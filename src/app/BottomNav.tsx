import { cn } from '@/lib/cn'

export type Screen = 'routines' | 'todos' | 'calendar' | 'settings'

const TABS: { id: Screen; label: string; icon: string }[] = [
  { id: 'routines', label: 'Rutiny', icon: '▦' },
  { id: 'todos', label: 'Úkoly', icon: '☑' },
  { id: 'calendar', label: 'Kalendář', icon: '▤' },
  { id: 'settings', label: 'Nastavení', icon: '⚙' },
]

export function BottomNav({
  active,
  onChange,
}: {
  active: Screen
  onChange: (s: Screen) => void
}) {
  return (
    <nav
      className="border-t border-line bg-panel"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-2xl">
        {TABS.map((t) => (
          <li key={t.id} className="flex-1">
            <button
              type="button"
              onClick={() => onChange(t.id)}
              className={cn(
                'flex w-full flex-col items-center gap-0.5 py-2 text-[11px] transition-colors',
                active === t.id ? 'text-parchment' : 'text-muted',
              )}
            >
              <span className="text-lg leading-none">{t.icon}</span>
              {t.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
