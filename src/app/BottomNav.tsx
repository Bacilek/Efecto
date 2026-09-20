import { cn } from '@/lib/cn'

export type Screen = 'routines' | 'todos' | 'calendar' | 'timetable' | 'settings'

const TABS: { id: Screen; label: string; icon: string }[] = [
  { id: 'routines', label: 'Routines', icon: '▦' },
  { id: 'todos', label: 'Todos', icon: '☑' },
  { id: 'calendar', label: 'Calendar', icon: '▤' },
  { id: 'timetable', label: 'Timetable', icon: '▥' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
]

/**
 * `alert` marks the Settings tab when sync has stopped carrying data — the one
 * failure the app must not keep to itself, since every other sign of it is the
 * absence of something.
 */
export function BottomNav({
  active,
  onChange,
  alert = false,
}: {
  active: Screen
  onChange: (s: Screen) => void
  alert?: boolean
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
              <span className="relative text-lg leading-none">
                {t.icon}
                {alert && t.id === 'settings' && (
                  <span className="absolute -right-1.5 top-0 h-1.5 w-1.5 rounded-full bg-missed" />
                )}
              </span>
              {t.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
