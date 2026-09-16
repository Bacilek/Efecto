import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, entryId, newId, stamp, type Entry, type Routine } from '@/db/db'
import { removeRecord, removeRecords } from '@/db/remove'
import { fromISODate, isoWeek, toISODate, todayISO, weekParity } from '@/lib/date'
import { ScreenHeader } from '@/ui/ScreenHeader'
import { EmptyState } from '@/ui/EmptyState'
import { RoutineGrid } from './RoutineGrid'
import { RoutineEditor, type RoutineDraft } from './RoutineEditor'
import { WeekNav } from './WeekNav'
import { useWeek } from './useWeek'
import { compareRoutines, nextStatus, resolveCellState } from './status'
import { weekCompletion } from './stats'

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

  const parity = weekParity(isoWeek(week.monday))

  const weekStats = useMemo(
    () => weekCompletion(routines ?? [], week.dates, entryMap, todayISO(), parity),
    [routines, week.dates, entryMap, parity],
  )

  async function tapCell(routine: Routine, dateISO: string) {
    const id = entryId(routine.id, dateISO)
    const current = await db.entries.get(id)
    // Ask what an empty cell would render as rather than assuming "past = red":
    // a weekly target derives no miss, so its empty step is visible.
    const clearsToMissed =
      resolveCellState(routine, fromISODate(dateISO), undefined, todayISO(), parity) === 'missed'
    const next = nextStatus(current?.status, clearsToMissed)
    if (next === undefined) {
      await removeRecord('entries', id)
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
        emoji: draft.emoji || undefined,
        activeDays: draft.activeDays,
        timesPerWeek: draft.timesPerWeek ?? undefined,
        weeks: draft.weeks ?? undefined,
      })
    } else {
      const maxOrder = (routines ?? []).reduce((m, r) => Math.max(m, r.order), -1)
      await db.routines.add({
        id: newId(),
        name: draft.name,
        emoji: draft.emoji || undefined,
        order: maxOrder + 1,
        activeDays: draft.activeDays,
        timesPerWeek: draft.timesPerWeek ?? undefined,
        weeks: draft.weeks ?? undefined,
        archived: false,
        ...stamp(),
      })
    }
    setEditor(null)
  }

  async function reorderRoutines(ids: string[]) {
    await db.transaction('rw', db.routines, () =>
      Promise.all(ids.map((id, i) => db.routines.update(id, { order: i }))),
    )
  }

  async function deleteRoutine() {
    const target = editor?.routine
    if (!target) return
    const entryIds = await db.entries.where('routineId').equals(target.id).primaryKeys()
    await removeRecords('entries', entryIds)
    await removeRecord('routines', target.id)
    setEditor(null)
  }

  return (
    <>
      <ScreenHeader
        title="Routines"
        action={
          <button
            type="button"
            onClick={() => setEditor({ routine: null })}
            className="rounded-md border border-line px-2.5 py-1 text-sm text-muted hover:border-muted"
          >
            + routine
          </button>
        }
      />
      <WeekNav week={week} />
      <WeekSummary pct={weekStats.pct} done={weekStats.done} total={weekStats.total} />

      {routines && routines.length === 0 ? (
        <EmptyState title="No routines yet." hint={'Add your first one with "+ routine".'} />
      ) : (
        <RoutineGrid
          dates={week.dates}
          routines={routines ?? []}
          parity={parity}
          entries={entryMap}
          onTapCell={(r, d) => void tapCell(r, d)}
          onEditRoutine={(r) => setEditor({ routine: r })}
          onReorder={(ids) => void reorderRoutines(ids)}
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

function WeekSummary({ pct, done, total }: { pct: number; done: number; total: number }) {
  return (
    <div className="px-4 pb-2">
      <div className="mb-1 flex items-baseline justify-between text-[11px]">
        <span className="text-muted">Done this week</span>
        <span className="font-mono text-muted">
          {done}/{total} · <span className="text-parchment">{pct} %</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-line-soft">
        <div className="h-full rounded-full bg-brass" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pt-4 text-[11px] text-muted">
      <Item cls="border-done bg-done-dim" label="done" />
      <Item cls="border-missed bg-missed-dim" label="missed" />
      <Item cls="border-busy bg-busy-dim" label="excused" />
      <Item cls="border-brass-dim" label="pending" />
      <span className="flex items-center gap-1.5">
        <span className="text-dim">–</span> not scheduled
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
