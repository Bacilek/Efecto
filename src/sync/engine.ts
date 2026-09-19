import { db, SYNCED_TABLES, type SyncedTable } from '@/db/db'
import { supabase, type RemoteRecord } from './supabase'

/** Server-time cursor of the last pull; a timestamptz string, per device. */
const PULL_CURSOR = 'syncPullCursor'
/** Client-time cursor of the last push: rows stamped after this are dirty. */
const PUSH_CURSOR = 'syncPushCursor'
/** The account whose data this device has been reconciled with — see `linkDevice`. */
const LINKED_ACCOUNT = 'syncLinkedAccount'
/** Epoch ms of the last sync that completed without error. */
const LAST_SYNC = 'syncLastAt'

/** Supabase caps a response anyway; paging keeps a first sync off one huge page. */
const PAGE = 1000

async function metaGet<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined
}

const metaSet = (key: string, value: unknown) => db.meta.put({ key, value })

export interface SyncResult {
  pushed: number
  pulled: number
  at: number
}

/** A record as it sits in one of the synced Dexie stores. */
type Row = { id: string; updatedAt: number }

/**
 * Push local changes, then pull everyone else's.
 *
 * Conflicts resolve last-write-wins on the client stamp: a remote row is
 * applied only when its `updated_at` is **strictly** greater than the local
 * one. Strictly matters — it is what stops two devices bouncing an identical
 * row back and forth forever, since a row echoed back by the server compares
 * equal and is dropped on arrival.
 */
export async function syncNow(): Promise<SyncResult> {
  if (!supabase) throw new Error('Sync is not configured on this build.')
  const { data: auth } = await supabase.auth.getUser()
  const user = auth.user
  if (!user) throw new Error('Not signed in.')

  const pushed = await push(user.id)
  const pulled = await pull()

  const at = Date.now()
  await metaSet(LAST_SYNC, at)
  return { pushed, pulled, at }
}

async function push(userId: string): Promise<number> {
  const since = (await metaGet<number>(PUSH_CURSOR)) ?? 0
  // The new cursor is taken *before* the rows are read, not after the upsert
  // returns: a write made during the round trip would otherwise land below a
  // cursor stamped afterwards and never be offered again. One millisecond back
  // covers a write landing in the very millisecond of the read, which may or
  // may not have made it into the payload — re-sending a row costs an
  // idempotent upsert, losing one costs the edit.
  const cursor = Date.now() - 1
  const payload: Array<Record<string, unknown>> = []

  for (const kind of SYNCED_TABLES) {
    const dirty = (await db.table<Row>(kind).where('updatedAt').above(since).toArray()) as Row[]
    for (const row of dirty) {
      payload.push({
        user_id: userId,
        kind,
        id: row.id,
        data: row,
        deleted: false,
        updated_at: row.updatedAt,
      })
    }
  }

  const graves = await db.tombstones.where('deletedAt').above(since).toArray()
  for (const t of graves) {
    payload.push({
      user_id: userId,
      kind: t.table,
      id: t.recordId,
      data: null,
      deleted: true,
      updated_at: t.deletedAt,
    })
  }

  if (payload.length > 0) {
    for (let i = 0; i < payload.length; i += PAGE) {
      const { error } = await supabase!
        .from('records')
        .upsert(payload.slice(i, i + PAGE), { onConflict: 'user_id,kind,id' })
      if (error) throw new Error(`Push failed: ${error.message}`)
    }
  }

  // The server row (deleted = true) is the durable tombstone from here on, so
  // the local copy has done its job and would only grow forever.
  await db.tombstones.where('deletedAt').belowOrEqual(cursor).delete()
  await metaSet(PUSH_CURSOR, cursor)
  return payload.length
}

async function pull(): Promise<number> {
  let cursor = (await metaGet<string>(PULL_CURSOR)) ?? '1970-01-01T00:00:00Z'
  let applied = 0

  for (;;) {
    const { data, error } = await supabase!
      .from('records')
      .select('kind, id, data, deleted, updated_at, synced_at')
      .gt('synced_at', cursor)
      .order('synced_at', { ascending: true })
      .limit(PAGE)
    if (error) throw new Error(`Pull failed: ${error.message}`)

    const rows = (data ?? []) as RemoteRecord[]
    if (rows.length === 0) break

    applied += await applyRemote(rows)
    cursor = rows[rows.length - 1].synced_at
    await metaSet(PULL_CURSOR, cursor)

    if (rows.length < PAGE) break
  }

  return applied
}

async function applyRemote(rows: RemoteRecord[]): Promise<number> {
  let applied = 0
  const now = Date.now()
  let highest = 0

  for (const remote of rows) {
    if (!(SYNCED_TABLES as readonly string[]).includes(remote.kind)) continue
    const table = db.table<Row>(remote.kind as SyncedTable)
    const local = await table.get(remote.id)
    if (local && local.updatedAt >= remote.updated_at) continue

    if (remote.deleted) {
      // No tombstone: the server already holds one, and writing another would
      // only push the same delete back out again.
      if (local) await table.delete(remote.id)
    } else if (remote.data) {
      await table.put({ ...(remote.data as Row), id: remote.id, updatedAt: remote.updated_at })
    }
    highest = Math.max(highest, remote.updated_at)
    applied++
  }

  // Applied rows are not local edits, so carry the push cursor past them —
  // otherwise the next push would send everything straight back. Clamped to our
  // own clock: a device running ahead must not push our cursor into the future
  // and swallow the edits we make in the meantime.
  if (highest > 0) {
    const cursor = (await metaGet<number>(PUSH_CURSOR)) ?? 0
    await metaSet(PUSH_CURSOR, Math.max(cursor, Math.min(highest, now)))
  }
  return applied
}

export const lastSyncedAt = () => metaGet<number>(LAST_SYNC)

/**
 * Whether this device still has to choose a direction for `userId`.
 *
 * Every install seeds its own default routines, timetable and folders, with
 * ids generated locally — so a second device that merely merged would end up
 * with two of everything rather than one shared set. The first sync on a device
 * therefore picks a side instead of guessing.
 */
export async function needsLinking(userId: string): Promise<boolean> {
  return (await metaGet<string>(LINKED_ACCOUNT)) !== userId
}

export type LinkDirection = 'upload' | 'download'

/**
 * Which way the first sync on this device should go, or null when only its
 * owner can say.
 *
 * The question exists because every install seeds its own routines, timetable
 * and folders under fresh ids, so a blind merge gives two of everything. But
 * that only makes it a *question* when both sides hold real work. An empty
 * account has nothing to lose, and a device still carrying nothing but its
 * seeds has nothing worth keeping — between them those are the two cases that
 * actually happen (a first device, and every device added afterwards, phone
 * included). Only a device that was used offline against an account that was
 * also used elsewhere has to be asked, and that one is asked rather than
 * guessed at, because either answer throws work away.
 */
export async function autoLinkDirection(userId: string): Promise<LinkDirection | null> {
  if (!supabase) return null
  const { count, error } = await supabase
    .from('records')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  // A failed count must not be read as "the cloud is empty" — that would upload
  // over an account whose rows simply couldn't be counted.
  if (error) throw new Error(`Sync failed: ${error.message}`)
  if (!count) return 'upload'
  return (await localIsPristine()) ? 'download' : null
}

/**
 * Whether this device holds nothing but what `db/seed.ts` put there: no marks,
 * no todos, no deletes, and not one seeded row edited since. `updatedAt` equals
 * `createdAt` exactly until the first write touches a row, which is what makes
 * "untouched" answerable at all.
 */
async function localIsPristine(): Promise<boolean> {
  if (await db.tombstones.count()) return false
  if (await db.entries.count()) return false
  if (await db.todos.count()) return false
  for (const kind of ['routines', 'lessons', 'todoFolders'] as const) {
    const rows = await db.table<{ createdAt?: number; updatedAt: number }>(kind).toArray()
    if (rows.some((r) => r.updatedAt !== r.createdAt)) return false
  }
  return true
}

/**
 * Reconcile this device with an account for the first time.
 *
 * `upload` keeps what is here and makes it the account's copy; `download`
 * discards the local rows and takes the cloud's. Either way the device is
 * linked afterwards and every later sync is an ordinary two-way merge.
 */
export async function linkDevice(userId: string, direction: LinkDirection): Promise<SyncResult> {
  if (!supabase) throw new Error('Sync is not configured on this build.')

  if (direction === 'download') {
    await db.transaction(
      'rw',
      [...SYNCED_TABLES.map((t) => db.table(t)), db.tombstones],
      async () => {
        for (const t of SYNCED_TABLES) await db.table(t).clear()
        // Local deletes must not travel either: this device is adopting the
        // cloud's history wholesale, not contributing its own.
        await db.tombstones.clear()
      },
    )
    await metaSet(PUSH_CURSOR, Date.now())
  } else {
    // Re-offer every local row to the server, whatever this device synced before.
    await metaSet(PUSH_CURSOR, 0)
  }
  await metaSet(PULL_CURSOR, '1970-01-01T00:00:00Z')
  await metaSet(LINKED_ACCOUNT, userId)
  return syncNow()
}

/** Forget this device's cursors, so the next sign-in asks for a direction again. */
export async function resetSyncState(): Promise<void> {
  await db.meta.bulkDelete([PULL_CURSOR, PUSH_CURSOR, LINKED_ACCOUNT, LAST_SYNC])
}
