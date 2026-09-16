import { useState } from 'react'
import { useSync } from '@/sync/useSync'

/**
 * The Settings block that owns cross-device sync: sign in, pick a direction the
 * first time, then watch it keep itself in order.
 */
export function SyncSection() {
  const { phase, email, lastAt, error, sync, link, signIn, signOut } = useSync()
  const [draft, setDraft] = useState('')
  const [sent, setSent] = useState(false)

  if (phase === 'off') {
    return (
      <Panel title="Sync" desc="Not configured on this build — data stays on this device.">
        <p className="text-xs text-dim">
          Add <code className="text-muted">VITE_SUPABASE_URL</code> and{' '}
          <code className="text-muted">VITE_SUPABASE_ANON_KEY</code> to a{' '}
          <code className="text-muted">.env</code> file and rebuild. See{' '}
          <code className="text-muted">supabase/schema.sql</code>.
        </p>
      </Panel>
    )
  }

  if (phase === 'signed-out') {
    return (
      <Panel title="Sync" desc="Sign in to share routines, todos and the timetable across devices.">
        {sent ? (
          <p className="text-sm text-muted">
            Check your inbox — the link signs this device in. You can close this tab.
          </p>
        ) : (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void signIn(draft.trim()).then(
                () => setSent(true),
                () => undefined,
              )
            }}
          >
            <input
              type="email"
              required
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="you@example.com"
              className="min-w-0 flex-1 rounded-md border border-line bg-ink px-3 py-1.5 text-sm text-parchment placeholder:text-dim focus:border-muted focus:outline-none"
            />
            <button className={btn} type="submit">
              Send link
            </button>
          </form>
        )}
        {error && <p className="text-xs text-missed">{error}</p>}
      </Panel>
    )
  }

  if (phase === 'needs-link') {
    return (
      <Panel
        title="Choose a starting point"
        desc={`Signed in as ${email}. This device has its own data and so may the cloud — pick which copy wins, once.`}
      >
        <p className="text-xs text-dim">
          Every install starts with the same default routines and timetable, but under different ids
          — merging blindly would give you two of everything. After this the two sides merge
          normally.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className={btn} onClick={() => void link('upload')}>
            Use this device&apos;s data
          </button>
          <button className={btnDanger} onClick={() => void link('download')}>
            Replace with the cloud copy
          </button>
        </div>
        {error && <p className="text-xs text-missed">{error}</p>}
      </Panel>
    )
  }

  return (
    <Panel
      title="Sync"
      desc={
        phase === 'syncing'
          ? 'Syncing…'
          : phase === 'error'
            ? 'Last sync failed.'
            : lastAt
              ? `Last synced ${relative(lastAt)}.`
              : 'Signed in.'
      }
    >
      <p className="text-xs text-muted">{email}</p>
      <div className="flex gap-2">
        <button className={btn} disabled={phase === 'syncing'} onClick={sync}>
          Sync now
        </button>
        <button className={btn} onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
      {error && <p className="text-xs text-missed">{error}</p>}
    </Panel>
  )
}

function relative(at: number): string {
  const s = Math.round((Date.now() - at) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`
  return new Date(at).toLocaleDateString()
}

const btn =
  'rounded-md border border-line px-3 py-1.5 text-sm text-parchment transition-colors hover:border-muted disabled:opacity-50'
const btnDanger =
  'rounded-md border border-missed-dim px-3 py-1.5 text-sm text-missed transition-colors hover:border-missed'

function Panel({
  title,
  desc,
  children,
}: {
  title: string
  desc: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-3 rounded-lg border border-line-soft bg-panel px-4 py-3">
      <div>
        <p className="text-sm text-parchment">{title}</p>
        <p className="text-xs text-muted">{desc}</p>
      </div>
      {children}
    </div>
  )
}
