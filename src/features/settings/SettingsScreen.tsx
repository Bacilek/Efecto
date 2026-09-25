import { useRef, useState, type ReactNode } from 'react'
import { db, SYNCED_TABLES } from '@/db/db'
import { seedIfEmpty } from '@/db/seed'
import { resetSyncState } from '@/sync/engine'
import { ScreenHeader } from '@/ui/ScreenHeader'
import { SyncSection } from './SyncSection'

interface Backup {
  app: 'efecto'
  version: number
  exportedAt: string
  routines: unknown[]
  entries: unknown[]
  /** added in backup v2; absent in older files */
  lessons?: unknown[]
  /** added in backup v3; absent in older files */
  todoFolders?: unknown[]
  /** added in backup v3; absent in older files */
  todos?: unknown[]
}

export function SettingsScreen() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string | null>(null)

  async function exportData() {
    const [routines, entries, lessons, todoFolders, todos] = await Promise.all([
      db.routines.toArray(),
      db.entries.toArray(),
      db.lessons.toArray(),
      db.todoFolders.toArray(),
      db.todos.toArray(),
    ])
    const backup: Backup = {
      app: 'efecto',
      version: 3,
      exportedAt: new Date().toISOString(),
      routines,
      entries,
      lessons,
      todoFolders,
      todos,
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `efecto-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importData(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as Backup
      if (parsed.app !== 'efecto') throw new Error('Not a valid Efecto backup.')
      // A v2 file carries no todos at all, which is not the same as carrying an
      // empty list — restoring one must not wipe the folders it never knew
      // about, so those tables are left alone unless the file speaks to them.
      const restoresTodos = !!parsed.todoFolders || !!parsed.todos
      await db.transaction(
        'rw',
        [db.routines, db.entries, db.lessons, db.todoFolders, db.todos],
        async () => {
          await db.routines.clear()
          await db.entries.clear()
          await db.lessons.clear()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await db.routines.bulkAdd(parsed.routines as any[])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await db.entries.bulkAdd(parsed.entries as any[])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await db.lessons.bulkAdd((parsed.lessons ?? []) as any[])
          if (!restoresTodos) return
          await db.todoFolders.clear()
          await db.todos.clear()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await db.todoFolders.bulkAdd((parsed.todoFolders ?? []) as any[])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await db.todos.bulkAdd((parsed.todos ?? []) as any[])
        },
      )
      // The import replaced everything wholesale, so this device no longer
      // shares a history with the account — the next sign-in asks which copy
      // wins rather than pushing the restored rows over the cloud's.
      await resetSyncState()
      setMsg('Data imported. Sign in again to re-link sync.')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Import failed.')
    }
  }

  async function resetData() {
    if (!confirm('Delete all data and restore the default routines?')) return
    const tables = [...SYNCED_TABLES.map((t) => db.table(t)), db.tombstones, db.meta]
    await db.transaction('rw', tables, async () => {
      for (const t of tables) await t.clear()
    })
    // `meta` held the sync cursors, so they are already gone with it — the
    // next sign-in treats this as a fresh device, which it now is.
    await seedIfEmpty()
    setMsg('Data reset to defaults.')
  }

  return (
    <>
      <ScreenHeader title="Settings" />
      <div className="space-y-3 px-4 pb-8">
        <SyncSection />

        <Row
          label="Back up data"
          desc="Downloads a JSON file with routines, marks and the timetable."
        >
          <button className={btn} onClick={() => void exportData()}>
            Export
          </button>
        </Row>

        <Row
          label="Restore from backup"
          desc="Overwrites the current data with a file, and resets this device's sync link — you'll choose a starting point again on next sign-in."
        >
          <button className={btnDanger} onClick={() => fileRef.current?.click()}>
            Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void importData(f)
              e.target.value = ''
            }}
          />
        </Row>

        <Row label="Reset" desc="Wipes everything and seeds the default routines.">
          <button className={btnDanger} onClick={() => void resetData()}>
            Reset
          </button>
        </Row>

        {msg && <p className="pt-1 text-sm text-muted">{msg}</p>}

        <p className="pt-6 text-center text-xs text-dim">Efecto · v0.1.0</p>
      </div>
    </>
  )
}

const btn =
  'rounded-md border border-line px-3 py-1.5 text-sm text-parchment transition-colors hover:border-muted'
const btnDanger =
  'rounded-md border border-missed-dim px-3 py-1.5 text-sm text-missed transition-colors hover:border-missed'

function Row({ label, desc, children }: { label: string; desc: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-line-soft bg-panel px-4 py-3">
      <div>
        <p className="text-sm text-parchment">{label}</p>
        <p className="text-xs text-muted">{desc}</p>
      </div>
      <div className="flex shrink-0 gap-2">{children}</div>
    </div>
  )
}
