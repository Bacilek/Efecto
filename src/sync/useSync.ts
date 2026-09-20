import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { onLocalWrite } from '@/db/db'
import { supabase, syncConfigured } from './supabase'
import {
  autoLinkDirection,
  lastSyncedAt,
  linkDevice,
  linkedAccount,
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
  /**
   * Sync is meant to be invisible, so the one thing it must never do is fail
   * invisibly: true when it has stopped carrying data and only the user can
   * restart it.
   */
  needsAttention: boolean
  sync: () => void
  link: (direction: LinkDirection) => Promise<void>
  signIn: (email: string) => Promise<void>
  verifyCode: (email: string, code: string) => Promise<void>
  signOut: () => Promise<void>
}

export function useSync(): SyncState {
  const [session, setSession] = useState<Session | null>(null)
  const [phase, setPhase] = useState<SyncPhase>(syncConfigured ? 'signed-out' : 'off')
  const [lastAt, setLastAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Whether this device was ever linked to an account. A device that used to
  // sync and now sits signed out has lost its session rather than chosen to be
  // local, and that is worth pointing at.
  const [everLinked, setEverLinked] = useState(false)
  // A sync in flight; its own writes must not schedule another one.
  const running = useRef(false)
  // The pending debounce, so closing the tab can flush it instead of dropping it.
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    void lastSyncedAt().then((t) => setLastAt(t ?? null))
    void linkedAccount().then((a) => setEverLinked(Boolean(a)))
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
      if (!direction) return null
      const res = await linkDevice(user.id, direction)
      setEverLinked(true)
      return res
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

    const schedule = () => {
      if (running.current) return
      clearTimeout(timer.current)
      timer.current = setTimeout(() => void run(), DEBOUNCE_MS)
    }

    const stopWatching = onLocalWrite(schedule)
    const poll = setInterval(() => void run(), POLL_MS)

    // Leaving is the riskiest moment there is: a tick made two seconds ago is
    // still sitting in the debounce, and on a phone a backgrounded tab may
    // never be woken again. So hiding flushes rather than waits — the round
    // trip may be cut short, in which case the row is simply still dirty and
    // goes out on the next open. Coming back reconciles for the same reason.
    const reconcile = () => {
      clearTimeout(timer.current)
      void run()
    }
    document.addEventListener('visibilitychange', reconcile)
    window.addEventListener('pagehide', reconcile)
    window.addEventListener('online', reconcile)

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
      clearTimeout(timer.current)
      clearInterval(poll)
      stopWatching()
      document.removeEventListener('visibilitychange', reconcile)
      window.removeEventListener('pagehide', reconcile)
      window.removeEventListener('online', reconcile)
      void supabase?.removeChannel(channel)
    }
  }, [session, run])

  const link = useCallback(
    async (direction: LinkDirection) => {
      const user = session?.user
      if (!user) return
      await guarded(() => linkDevice(user.id, direction))
      setEverLinked(true)
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

  /**
   * Sign in with the code from the same email instead of its link.
   *
   * The link opens in whatever the system browser is, which on a phone is not
   * the installed PWA — following it signs in a different origin's copy of the
   * app and leaves the one you actually use signed out. A typed code signs in
   * the window it was typed into, so it works everywhere the link doesn't.
   */
  const verifyCode = useCallback(async (email: string, code: string) => {
    if (!supabase) return
    setError(null)
    const { error: err } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
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
    setEverLinked(false)
  }, [])

  return {
    phase,
    session,
    email: session?.user.email ?? null,
    lastAt,
    error,
    needsAttention:
      phase === 'error' || phase === 'needs-link' || (phase === 'signed-out' && everLinked),
    sync: () => void run(),
    link,
    signIn,
    verifyCode,
    signOut,
  }
}
