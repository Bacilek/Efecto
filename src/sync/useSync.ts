import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { onLocalWrite } from '@/db/db'
import { supabase, syncConfigured } from './supabase'
import {
  autoLinkDirection,
  lastSyncedAt,
  linkDevice,
  needsLinking,
  resetSyncState,
  syncNow,
  type LinkDirection,
  type SyncResult,
} from './engine'

/** A local write settles for this long before it is worth a round trip. */
const DEBOUNCE_MS = 2500
/**
 * Backstop only. Realtime is what actually carries a change from one device to
 * the next; this catches the rare trigger dropped because a sync was already in
 * flight, and any stretch where the socket is down.
 */
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

  /**
   * The phase and error bookkeeping a sync and a first link both need. A null
   * result means the work stopped to ask which copy wins.
   */
  const guarded = useCallback(async (work: () => Promise<SyncResult | null>) => {
    running.current = true
    setPhase('syncing')
    setError(null)
    try {
      const res = await work()
      if (res) setLastAt(res.at)
      setPhase(res ? 'idle' : 'needs-link')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed.')
      setPhase('error')
    } finally {
      running.current = false
    }
  }, [])

  const run = useCallback(async () => {
    if (!supabase || running.current) return
    const user = session?.user
    if (!user) return
    await guarded(async () => {
      if (!(await needsLinking(user.id))) return syncNow()
      // A device added to an account settles its own direction wherever that
      // is not a real choice — which is every device but the awkward one.
      const direction = await autoLinkDirection(user.id)
      return direction ? linkDevice(user.id, direction) : null
    })
  }, [session, guarded])

  // Sign in, come back to the tab, save something, or just sit there — each is
  // a reason to reconcile, and none of them should need a button.
  useEffect(() => {
    if (!session || !supabase) {
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

    // The server says when another device wrote, so a change lands here in
    // about a second instead of waiting out the poll. The rows this device
    // pushed come back as events too; that costs one round trip that applies
    // nothing, because an echo never compares newer than what is already here.
    const channel = supabase
      .channel(`records:${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'records',
          filter: `user_id=eq.${session.user.id}`,
        },
        schedule,
      )
      .subscribe()

    return () => {
      clearTimeout(timer)
      clearInterval(poll)
      stopWatching()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
      void supabase?.removeChannel(channel)
    }
  }, [session, run])

  const link = useCallback(
    async (direction: LinkDirection) => {
      const user = session?.user
      if (!user) return
      await guarded(() => linkDevice(user.id, direction))
    },
    [session, guarded],
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
