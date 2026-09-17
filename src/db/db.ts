import Dexie, { type EntityTable } from 'dexie'
import type { WeekdayIndex, WeekParity } from '@/lib/date'

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
  /**
   * When set, the routine is a **weekly target** of this many marks rather than
   * an obligation on particular weekdays: every day becomes markable,
   * `activeDays` is ignored and an unmarked past day is not a miss.
   */
  timesPerWeek?: number
  /**
   * Restrict the routine to odd or even **ISO** weeks (the parity `WeekNav`
   * displays). Unset = every week.
   */
  weeks?: WeekParity
  archived: boolean
  createdAt: number
  /** epoch ms of the last local write; the sync engine's conflict tie-break */
  updatedAt: number
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

/** Lecture / seminar ("cviko") / lab — drives the block's colour. */
export type LessonKind = 'lecture' | 'seminar' | 'lab'

/**
 * How one occurrence of a lesson was dealt with: sat in the room, watched the
 * live stream, watched the recording afterwards, or already knew the material.
 */
export type LessonCover = 'attended' | 'stream' | 'recording' | 'known'

/**
 * A school timetable entry. The timetable is a weekly template — it repeats
 * every week and carries no dates, unlike routine `Entry` rows.
 */
export interface Lesson {
  id: string
  /** subject code, e.g. "PV170" */
  name: string
  kind: LessonKind
  /** seminar group, the part after the slash in "MB142/09" */
  group?: string
  room?: string
  /** 0=Mon .. 4=Fri — the timetable covers weekdays only */
  day: WeekdayIndex
  /** "HH:MM", inside the grid's 08:00–20:00 window */
  start: string
  /** "HH:MM", after `start` */
  end: string
  /**
   * Dates (`YYYY-MM-DD`) the lesson is cancelled on. Ignored when `onlyDates`
   * is set.
   */
  skipDates?: string[]
  /**
   * When non-empty, the lesson happens on these dates ONLY — for a one-off or a
   * block that doesn't follow the weekly rhythm.
   */
  onlyDates?: string[]
  /**
   * Restrict the lesson to odd or even **semester** weeks (the parity
   * `SemesterNav` displays). Unset = every week.
   */
  weeks?: WeekParity
  /**
   * The lesson is recorded, so it doesn't have to be attended in person — the
   * block gets a camera in its top-right corner. Matters because of the commute.
   */
  recorded?: boolean
  /**
   * How many excused absences the subject allows **per semester** (seminars and
   * labs usually allow a few). Unset = attendance isn't tracked.
   */
  absenceLimit?: number
  /**
   * Dates (`YYYY-MM-DD`) the lesson was missed. The lesson still happened —
   * unlike `skipDates`, which cancels it. Dates outside the current semester
   * are ignored, so the allowance resets with the semester bounds.
   */
  absentDates?: string[]
  /**
   * Occurrences ticked off on the Todos **Today** tab, keyed by `YYYY-MM-DD`,
   * with how the material was covered. Unlisted = not ticked yet.
   */
  coveredDates?: Record<string, LessonCover>
  createdAt: number
  /** epoch ms of the last local write; the sync engine's conflict tie-break */
  updatedAt: number
}

/**
 * A named category of todos. Todos are dateless — a folder is the only grouping
 * they have — so every todo either sits in one or in the "Unsorted" bucket.
 */
export interface TodoFolder {
  id: string
  name: string
  /** optional single emoji shown before the name */
  emoji?: string
  /** manual sort order (lower first) */
  order: number
  /**
   * The catch-all folder a new todo lands in when nothing else is picked.
   * At most one folder carries it (the seeded "Others").
   */
  isDefault?: boolean
  createdAt: number
  /** epoch ms of the last local write; the sync engine's conflict tie-break */
  updatedAt: number
}

/**
 * A task with no date or time. Deliberately dateless for now: anything that
 * belongs on a day goes to the calendar instead.
 */
export interface Todo {
  id: string
  /** the folder it lives in; unset = "Unsorted" */
  folderId?: string
  title: string
  note?: string
  done: boolean
  /** epoch ms of the last tick, kept so completed todos can be ordered */
  doneAt?: number
  /**
   * `YYYY-MM-DD` the todo was pulled onto the **Today** tab. Not a due date —
   * the todo keeps living in its folder, this only says "I mean to do it
   * today". An older date stays listed (a carried-over task), so nothing
   * planned quietly disappears unfinished.
   */
  plannedFor?: string
  /**
   * `YYYY-MM-DD` the todo *first* landed on Today in its current run — kept so
   * a task sliding from day to day can say how long it has been sliding.
   * `plannedFor` moves with every postponement; this one doesn't, and is
   * cleared only when the task leaves Today altogether. Unset on todos planned
   * before the field existed, which then fall back to `plannedFor`.
   */
  plannedSince?: string
  /** manual sort order within the folder (lower first) */
  order: number
  createdAt: number
  /** epoch ms of the last local write; the sync engine's conflict tie-break */
  updatedAt: number
}

export interface Meta {
  key: string
  value: unknown
}

/**
 * The tables the sync engine carries. `meta` is deliberately absent: it holds
 * per-device state (seed guards, the sync cursor) that must not travel.
 */
export const SYNCED_TABLES = ['routines', 'entries', 'lessons', 'todoFolders', 'todos'] as const
export type SyncedTable = (typeof SYNCED_TABLES)[number]

/**
 * A record that was deleted locally. Deletes are hard, so without this a
 * deletion would look identical to "this device has never seen that row" and
 * the next pull would simply resurrect it.
 */
export interface Tombstone {
  /** `${table}|${recordId}` */
  id: string
  table: SyncedTable
  recordId: string
  /** epoch ms of the delete — compared against a remote row's `updatedAt` */
  deletedAt: number
}

export const db = new Dexie('efecto') as Dexie & {
  routines: EntityTable<Routine, 'id'>
  entries: EntityTable<Entry, 'id'>
  lessons: EntityTable<Lesson, 'id'>
  todoFolders: EntityTable<TodoFolder, 'id'>
  todos: EntityTable<Todo, 'id'>
  tombstones: EntityTable<Tombstone, 'id'>
  meta: EntityTable<Meta, 'key'>
}

db.version(1).stores({
  // `archived` is a boolean → not indexed (IndexedDB can't key booleans); filter in JS.
  routines: 'id, order',
  entries: 'id, routineId, date',
  meta: 'key',
})

// v2 adds the timetable. Dexie needs every store repeated; existing data is untouched.
db.version(2).stores({
  routines: 'id, order',
  entries: 'id, routineId, date',
  lessons: 'id, day',
  meta: 'key',
})

// v3 adds `kind` to lessons. Same stores, so only the upgrade hook matters:
// lessons written before kinds existed default to a lecture.
db.version(3)
  .stores({
    routines: 'id, order',
    entries: 'id, routineId, date',
    lessons: 'id, day',
    meta: 'key',
  })
  .upgrade((tx) =>
    tx
      .table<Lesson>('lessons')
      .toCollection()
      .modify((l) => {
        l.kind ??= 'lecture'
      }),
  )

// v4 adds todos: named folders plus the tasks inside them. `done` is a boolean
// (not indexable) and `folderId` may be unset, so both are filtered in JS —
// the lists are small enough that only `order` is worth an index.
db.version(4).stores({
  routines: 'id, order',
  entries: 'id, routineId, date',
  lessons: 'id, day',
  todoFolders: 'id, order',
  todos: 'id, order',
  meta: 'key',
})

// v5 adds sync: an `updatedAt` stamp on every synced row plus the tombstone
// table that lets a delete travel. Rows written before the stamp existed fall
// back to `createdAt` — the oldest plausible time, so a genuine edit on another
// device always wins over an un-stamped local row.
db.version(5)
  .stores({
    routines: 'id, order, updatedAt',
    entries: 'id, routineId, date, updatedAt',
    lessons: 'id, day, updatedAt',
    todoFolders: 'id, order, updatedAt',
    todos: 'id, order, updatedAt',
    tombstones: 'id, deletedAt',
    meta: 'key',
  })
  .upgrade(async (tx) => {
    for (const name of SYNCED_TABLES) {
      await tx
        .table<{ createdAt?: number; updatedAt?: number }>(name)
        .toCollection()
        .modify((row) => {
          row.updatedAt ??= row.createdAt ?? 0
        })
    }
  })

const writeListeners = new Set<() => void>()

/**
 * Fires after any write to a synced table. The sync engine listens so a change
 * reaches the other device on its own, rather than waiting for the next poll or
 * for someone to press a button.
 */
export function onLocalWrite(fn: () => void): () => void {
  writeListeners.add(fn)
  return () => writeListeners.delete(fn)
}

const notifyWrite = () => writeListeners.forEach((fn) => fn())

// Stamp `updatedAt` on every write so the sync engine never has to trust a call
// site to remember. A mutation that passes its own stamp keeps it — that is how
// `applyRemote` writes a pulled row without making it look locally modified.
for (const name of SYNCED_TABLES) {
  const table = db.table(name)
  table.hook('creating', (_key, obj: { updatedAt?: number; createdAt?: number }) => {
    obj.updatedAt ??= obj.createdAt ?? Date.now()
    notifyWrite()
  })
  table.hook('updating', function (mods: object) {
    notifyWrite()
    return 'updatedAt' in mods ? undefined : { updatedAt: Date.now() }
  })
  table.hook('deleting', notifyWrite)
}

export function entryId(routineId: string, dateISO: string): string {
  return `${routineId}|${dateISO}`
}

/**
 * `createdAt` / `updatedAt` for a brand-new row. The `creating` hook would fill
 * `updatedAt` in anyway; spelling it out keeps the two stamps identical and the
 * record type honest at the call site.
 */
export function stamp(): { createdAt: number; updatedAt: number } {
  const now = Date.now()
  return { createdAt: now, updatedAt: now }
}

export function newId(): string {
  return crypto.randomUUID()
}
