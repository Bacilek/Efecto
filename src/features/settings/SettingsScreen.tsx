import { useRef, useState, type ReactNode } from 'react'
import { db } from '@/db/db'
import { seedIfEmpty } from '@/db/seed'
import { ScreenHeader } from '@/ui/ScreenHeader'

interface Backup {
  app: 'efecto'
  version: number
  exportedAt: string
  routines: unknown[]
  entries: unknown[]
}

export function SettingsScreen() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string | null>(null)

  async function exportData() {
    const [routines, entries] = await Promise.all([db.routines.toArray(), db.entries.toArray()])
    const backup: Backup = {
      app: 'efecto',
      version: 1,
      exportedAt: new Date().toISOString(),
      routines,
      entries,
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
      if (parsed.app !== 'efecto') throw new Error('Neplatný soubor.')
      await db.transaction('rw', db.routines, db.entries, async () => {
        await db.routines.clear()
        await db.entries.clear()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await db.routines.bulkAdd(parsed.routines as any[])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await db.entries.bulkAdd(parsed.entries as any[])
      })
      setMsg('Data importována.')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Import selhal.')
    }
  }

  async function resetData() {
    if (!confirm('Smazat všechna data a obnovit výchozí rutiny?')) return
    await db.transaction('rw', db.routines, db.entries, db.meta, async () => {
      await db.routines.clear()
      await db.entries.clear()
      await db.meta.clear()
    })
    await seedIfEmpty()
    setMsg('Data obnovena na výchozí.')
  }

  return (
    <>
      <ScreenHeader title="Nastavení" />
      <div className="space-y-3 px-4 pb-8">
        <Row label="Zálohovat data" desc="Stáhne JSON se všemi rutinami a záznamy.">
          <button className={btn} onClick={() => void exportData()}>
            Export
          </button>
        </Row>

        <Row label="Obnovit ze zálohy" desc="Přepíše současná data souborem.">
          <button className={btn} onClick={() => fileRef.current?.click()}>
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

        <Row label="Reset" desc="Smaže vše a nasadí výchozí rutiny.">
          <button className={btnDanger} onClick={() => void resetData()}>
            Reset
          </button>
        </Row>

        {msg && <p className="pt-1 text-sm text-muted">{msg}</p>}

        <p className="pt-6 text-center text-xs text-dim">Efecto · v0.1.0 · data uložena v zařízení</p>
      </div>
    </>
  )
}

const btn =
  'rounded-md border border-line px-3 py-1.5 text-sm text-parchment transition-colors hover:border-muted'
const btnDanger =
  'rounded-md border border-missed-dim px-3 py-1.5 text-sm text-missed transition-colors hover:border-missed'

function Row({
  label,
  desc,
  children,
}: {
  label: string
  desc: string
  children: ReactNode
}) {
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
