import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { onLocalWrite } from '@/db/db'
import { supabase, syncConfigured } from './supabase'
import {
  lastSyncedAt,
  linkDevice,
  needsLinking,
  resetSyncState,
  syncNow,
  type LinkDirection,
} from './engine'

/** A local write settles for this long before it is worth a round trip. */
const DEBOUNCE_MS = 2500
/** Backstop for changes made on the other device while this one sits idle. */
const POLL_MS = 60_000

export type SyncPhase = 'off' | 'signed-out' | 'needs-link' | 'idle' | 'syncing' | 'error'

export interface SyncState {
  phase: SyncPhase
  session: Session | null
  email: string | null
  lastAt: number | null
  error: string | null
  sync: () => void
  link: (direction: LinkDirection) => Promise<void>
  signIn: (email: string) => Promise<void>
  signOut: () => Promise<void>
}

export function useSync(): SyncState {
  const [session, setSession] = useState<Session | null>(null)
  const [phase, setPhase] = useState<SyncPhase>(syncConfigured ? 'signed-out' : 'off')
  const [lastAt, setLastAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  // A sync in flight; its own writes must not schedule another one.
  const running = useRef(false)

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    void lastSyncedAt().then((t) => setLastAt(t ?? null))
  }, [session])

  const run = useCallback(async () => {
    if (!supabase || running.current) return
    const user = session?.user
    if (!user) return
    if (await needsLinking(user.id)) {
      setPhase('needs-link')
      return
    }
    running.current = true
    setPhase('syncing')
    setError(null)
    try {
      const res = await syncNow()
      setLastAt(res.at)
      setPhase('idle')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed.')
      setPhase('error')
    } finally {
      running.current = false
    }
  }, [session])

  // Sign in, come back to the tab, save something, or just sit there — each is
  // a reason to reconcile, and none of them should need a button.
  useEffect(() => {
    if (!session) {
      setPhase(syncConfigured ? 'signed-out' : 'off')
      return
    }
    void run()

    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = () => {
      if (running.current) return
      clearTimeout(timer)
      timer = setTimeout(() => void run(), DEBOUNCE_MS)
    }

    const stopWatching = onLocalWrite(schedule)
    const onVisible = () => document.visibilityState === 'visible' && void run()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    const poll = setInterval(() => void run(), POLL_MS)

    return () => {
      clearTimeout(timer)
      clearInterval(poll)
      stopWatching()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
    }
  }, [session, run])

  const link = useCallback(
    async (direction: LinkDirection) => {
      const user = session?.user
      if (!user) return
      running.current = true
      setPhase('syncing')
      setError(null)
      try {
        const res = await linkDevice(user.id, direction)
        setLastAt(res.at)
        setPhase('idle')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Sync failed.')
        setPhase('error')
      } finally {
        running.current = false
      }
    },
    [session],
  )

  const signIn = useCallback(async (email: string) => {
    if (!supabase) return
    setError(null)
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (err) {
      setError(err.message)
      setPhase('error')
      throw err
    }
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    // Cursors are per device *and* per account, so the next sign-in starts by
    // asking which copy wins rather than silently merging two people's data.
    await resetSyncState()
    setLastAt(null)
  }, [])

  return {
    phase,
    session,
    email: session?.user.email ?? null,
    lastAt,
    error,
    sync: () => void run(),
    link,
    signIn,
    signOut,
  }
}
