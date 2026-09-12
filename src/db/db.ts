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
  createdAt: number
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
  /** manual sort order within the folder (lower first) */
  order: number
  createdAt: number
}

export interface Meta {
  key: string
  value: unknown
}

export const db = new Dexie('efecto') as Dexie & {
  routines: EntityTable<Routine, 'id'>
  entries: EntityTable<Entry, 'id'>
  lessons: EntityTable<Lesson, 'id'>
  todoFolders: EntityTable<TodoFolder, 'id'>
  todos: EntityTable<Todo, 'id'>
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

export function entryId(routineId: string, dateISO: string): string {
  return `${routineId}|${dateISO}`
}

export function newId(): string {
  return crypto.randomUUID()
}
