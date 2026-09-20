import type { ReactNode } from 'react'
import { SyncContext } from './syncContext'
import { useSync, type SyncState } from './useSync'

/**
 * Sync has to outlive the Settings screen.
 *
 * `useSync` owns every automatic trigger there is — the debounce on a local
 * write, the realtime channel, the poll, the reconcile on focus — and all of
 * them live and die with the component that called the hook. Called from
 * `SyncSection`, that meant the app only synced while Settings was on screen:
 * a morning spent ticking routines synced nothing at all, and "Sync now"
 * stopped being a convenience and became the only thing that worked.
 *
 * So the hook is called once, here, above the screen switch, and the Settings
 * block reads the same state through `useSyncState`. Sync is infrastructure,
 * not a feature of one tab.
 */
export function SyncProvider({ children }: { children: (state: SyncState) => ReactNode }) {
  const state = useSync()
  return <SyncContext.Provider value={state}>{children(state)}</SyncContext.Provider>
}
