import Dexie, { type EntityTable } from 'dexie'
import type { WeekdayIndex } from '@/lib/date'

export type RoutineStatus = 'done' | 'busy' | 'missed'

export interface Routine {
  id: string
  name: string
  /** single emoji shown as the column header (falls back to `name` if unset) */
  emoji?: string
  /** manual sort order (lower first); tie-break after `time` */
  order: number
  /** weekdays the routine applies to, 0=Mon .. 6=Sun */
  activeDays: WeekdayIndex[]
  /** optional "HH:MM", used only for column ordering */
  time?: string
  archived: boolean
  createdAt: number
}

export interface Entry {
  /** `${routineId}|${dateISO}` */
  id: string
  routineId: string
  /** `YYYY-MM-DD` */
  date: string
  status: RoutineStatus
  updatedAt: number
}

export interface Meta {
  key: string
  value: unknown
}

export const db = new Dexie('efecto') as Dexie & {
  routines: EntityTable<Routine, 'id'>
  entries: EntityTable<Entry, 'id'>
  meta: EntityTable<Meta, 'key'>
}

db.version(1).stores({
  // `archived` is a boolean → not indexed (IndexedDB can't key booleans); filter in JS.
  routines: 'id, order',
  entries: 'id, routineId, date',
  meta: 'key',
})

export function entryId(routineId: string, dateISO: string): string {
  return `${routineId}|${dateISO}`
}

export function newId(): string {
  return crypto.randomUUID()
}
