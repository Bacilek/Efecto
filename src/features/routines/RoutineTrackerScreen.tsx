import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, entryId, newId, type Entry, type Routine } from '@/db/db'
import { toISODate } from '@/lib/date'
import { ScreenHeader } from '@/ui/ScreenHeader'
import { EmptyState } from '@/ui/EmptyState'
import { RoutineGrid } from './RoutineGrid'
import { RoutineEditor, type RoutineDraft } from './RoutineEditor'
import { WeekNav } from './WeekNav'
import { useWeek } from './useWeek'
import { compareRoutines, nextStatus } from './status'

type EditorTarget = { routine: Routine | null } | null

export function RoutineTrackerScreen() {
  const week = useWeek()
  const [editor, setEditor] = useState<EditorTarget>(null)

  const routines = useLiveQuery(async () => {
    const all = await db.routines.toArray()
    return all.filter((r) => !r.archived).sort(compareRoutines)
  }, [])

  const weekFrom = toISODate(week.dates[0])
  const weekTo = toISODate(week.dates[6])
  const weekEntries = useLiveQuery(
    () => db.entries.where('date').between(weekFrom, weekTo, true, true).toArray(),
    [weekFrom, weekTo],
  )

  const entryMap = useMemo(() => {
    const m = new Map<string, Entry>()
    for (const e of weekEntries ?? []) m.set(e.id, e)
    return m
  }, [weekEntries])

  async function tapCell(routine: Routine, dateISO: string) {
    const id = entryId(routine.id, dateISO)
    const current = await db.entries.get(id)
    const next = nextStatus(current?.status)
    if (next === undefined) {
      await db.entries.delete(id)
    } else {
      await db.entries.put({
        id,
        routineId: routine.id,
        date: dateISO,
        status: next,
        updatedAt: Date.now(),
      })
    }
  }

  async function saveRoutine(draft: RoutineDraft) {
    const target = editor?.routine
    if (target) {
      await db.routines.update(target.id, {
        name: draft.name,
        time: draft.time || undefined,
        activeDays: draft.activeDays,
      })
    } else {
      const maxOrder = (routines ?? []).reduce((m, r) => Math.max(m, r.order), -1)
      await db.routines.add({
        id: newId(),
        name: draft.name,
        order: maxOrder + 1,
        activeDays: draft.activeDays,
        time: draft.time || undefined,
        archived: false,
        createdAt: Date.now(),
      })
    }
    setEditor(null)
  }

  async function deleteRoutine() {
    const target = editor?.routine
    if (!target) return
    await db.transaction('rw', db.routines, db.entries, async () => {
      await db.entries.where('routineId').equals(target.id).delete()
      await db.routines.delete(target.id)
    })
    setEditor(null)
  }

  return (
    <>
      <ScreenHeader
        title="Rutiny"
        action={
          <button
            type="button"
            onClick={() => setEditor({ routine: null })}
            className="rounded-md border border-line px-2.5 py-1 text-sm text-muted hover:border-muted"
          >
            + rutina
          </button>
        }
      />
      <WeekNav week={week} />

      {routines && routines.length === 0 ? (
        <EmptyState title="Žádné rutiny." hint={'Přidej první přes „+ rutina".'} />
      ) : (
        <RoutineGrid
          dates={week.dates}
          routines={routines ?? []}
          entries={entryMap}
          onTapCell={(r, d) => void tapCell(r, d)}
          onEditRoutine={(r) => setEditor({ routine: r })}
        />
      )}

      <Legend />

      {editor && (
        <RoutineEditor
          routine={editor.routine}
          onSave={(d) => void saveRoutine(d)}
          onDelete={() => void deleteRoutine()}
          onClose={() => setEditor(null)}
        />
      )}
    </>
  )
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pt-4 text-[11px] text-muted">
      <Item cls="border-done bg-done-dim" label="splněno" />
      <Item cls="border-busy bg-busy-dim" label="nestihnuto" />
      <Item cls="border-missed bg-missed-dim" label="nesplněno" />
      <Item cls="border-brass-dim" label="čeká" />
      <span className="flex items-center gap-1.5">
        <span className="text-dim">–</span> neplatí
      </span>
    </div>
  )
}

function Item({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-3.5 w-3.5 rounded border-[1.5px] ${cls}`} />
      {label}
    </span>
  )
}
