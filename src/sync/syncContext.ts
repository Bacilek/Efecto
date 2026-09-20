import { createContext, useContext } from 'react'
import type { SyncState } from './useSync'

export const SyncContext = createContext<SyncState | null>(null)

/** The live sync state, from the provider above every screen. */
export function useSyncState(): SyncState {
  const ctx = useContext(SyncContext)
  if (!ctx) throw new Error('useSyncState must be used inside <SyncProvider>.')
  return ctx
}
