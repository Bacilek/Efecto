import { db, type SyncedTable } from './db'

/**
 * Delete rows and leave a tombstone behind for each one.
 *
 * Deletes are hard, so a vanished row is indistinguishable from one this device
 * has simply never seen — without the tombstone the next pull would resurrect
 * everything the user just deleted. The stamp is what the sync engine compares
 * against a remote row's `updatedAt`, so a delete here still loses to a genuine
 * later edit made on the other device.
 *
 * A Dexie `deleting` hook would be the tidier place for this, but it runs
 * inside the caller's transaction, and the call sites don't have `tombstones`
 * in scope — so this stays an explicit helper.
 */
export async function removeRecords(table: SyncedTable, ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const deletedAt = Date.now()
  await db.transaction('rw', db.table(table), db.tombstones, async () => {
    await db.table(table).bulkDelete(ids)
    await db.tombstones.bulkPut(
      ids.map((recordId) => ({ id: `${table}|${recordId}`, table, recordId, deletedAt })),
    )
  })
}

/** Convenience for the common one-row case. */
export const removeRecord = (table: SyncedTable, id: string): Promise<void> =>
  removeRecords(table, [id])
