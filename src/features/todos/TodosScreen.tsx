import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, stamp, type Lesson, type Todo, type TodoFolder } from '@/db/db'
import { removeRecord, removeRecords } from '@/db/remove'
import { cn } from '@/lib/cn'
import { formatShort, fromISODate, todayISO } from '@/lib/date'
import { ScreenHeader } from '@/ui/ScreenHeader'
import { EmptyState } from '@/ui/EmptyState'
import { TodoEditor, type TodoDraft } from './TodoEditor'
import { FolderEditor, type FolderDraft } from './FolderEditor'
import { SubjectList } from './SubjectList'
import { SubjectDayNav } from './SubjectDayNav'
import { SubjectDayList } from './SubjectDayList'
import { PlannedDayList } from './PlannedDayList'
import { DuesList } from './DuesList'
import { buildSubjectGroups } from './subjects'
import { buildSubjectDayGroups } from './subjectDay'
import { coverOn, coverPatch, lessonOccurrences, pendingSeminarAbsences } from '@/features/timetable/cover'
import { toggledAbsence } from '@/features/timetable/absence'
import {
  dueRolloverPatch,
  isCarriedOver,
  isDue,
  isOnToday,
  isOverdue,
  isPlannedAhead,
  nextDay,
  planPatch,
  plannedSinceOf,
  plannedTodoStatus,
  type DayStatus,
} from './today'

/** `{ todo: null }` opens the sheet for a new todo in `folderId`. */
type TodoTarget = { todo: Todo | null; folderId: string | null; plannedFor: string | null } | null
type FolderTarget = { folder: TodoFolder | null } | null

/** The two sub-tabs: what I mean to do today, and everything there is. */
type Tab = 'today' | 'all'

/** One folder's tile: the folder itself, or the fallback bucket when null. */
interface Section {
  /** folder id, or `UNSORTED` for the loose todos */
  key: string
  folder: TodoFolder | null
  todos: Todo[]
}

const UNSORTED = 'unsorted'

export function TodosScreen() {
  const [tab, setTab] = useState<Tab>('today')
  const [todoEditor, setTodoEditor] = useState<TodoTarget>(null)
  const [folderEditor, setFolderEditor] = useState<FolderTarget>(null)
  /** which folder is open on the All tab; null = the tile overview */
  const [openKey, setOpenKey] = useState<string | null>(null)
  /** the day `SubjectDayNav` is paged to; today by default */
  const [viewDate, setViewDate] = useState(todayISO())

  const folders = useLiveQuery(() => db.todoFolders.orderBy('order').toArray(), [])
  const todos = useLiveQuery(() => db.todos.toArray(), [])
  const lessons = useLiveQuery(() => db.lessons.toArray(), [])

  const today = todayISO()

  const sections = useMemo<Section[]>(
    () => buildSections(folders ?? [], todos ?? []),
    [folders, todos],
  )

  // Today's list follows the folder order, so it reads in the same sequence as
  // the tiles, and within a folder falls back to the title rather than each
  // task's own per-folder `order` — flattening straight to that would let two
  // folders' overlapping order numbers interleave and break the grouping.
  // Ticked tasks still sink to the bottom exactly as they do in a folder.
  const todayTodos = useMemo(() => sortToday(sections, today), [sections, today])

  // Todos with a deadline get their own group above the folder-grouped list —
  // `sortToday` leaves them out of that one so they don't show twice.
  const dueTodos = useMemo(() => sortDues(todos ?? [], today), [todos, today])

  // Today's classes from the timetable plus any earlier one still uncovered,
  // merged with subject-tagged todos into one collapsible group per subject.
  const classOccurrences = useMemo(() => lessonOccurrences(lessons ?? [], today), [lessons, today])
  const subjectGroups = useMemo(
    () => buildSubjectGroups(classOccurrences, todos ?? [], today),
    [classOccurrences, todos, today],
  )
  const openSubjectItems = subjectGroups.reduce(
    (sum, g) =>
      sum +
      g.occurrences.filter((o) => !coverOn(o.lesson, o.date)).length +
      g.todos.filter((t) => !t.done).length,
    0,
  )

  // The distinct subject codes the timetable knows about, for the editor's
  // Subject picker — a plain chip list rather than free typing, so a todo's
  // tag always matches a real `Lesson.name`.
  const lessonSubjects = useMemo(
    () => [...new Set((lessons ?? []).map((l) => l.name))].sort((a, b) => a.localeCompare(b)),
    [lessons],
  )

  // Whether there's anything for the day pager to ever show — hidden
  // entirely rather than an empty box when the user has no timetable, no
  // subject-tagged todos, and has never planned a plain todo for a day.
  const hasDayPagerContent =
    (lessons?.length ?? 0) > 0 ||
    (todos ?? []).some((t) => t.subject !== undefined || t.plannedFor !== undefined)

  // A day other than today is a fixed-day report (`buildSubjectDayGroups`),
  // not the live worklist — see `subjectDay.ts` for why those are kept as
  // separate code paths.
  const dayGroups = useMemo(
    () =>
      viewDate === today ? [] : buildSubjectDayGroups(lessons ?? [], todos ?? [], viewDate, today),
    [lessons, todos, viewDate, today],
  )

  // Plain (non-subject) planned todos for that same day — a subject-tagged
  // one is already covered by `dayGroups`, so it's excluded here.
  const plannedDayItems = useMemo(() => {
    if (viewDate === today) return []
    const items: { todo: Todo; status: DayStatus }[] = []
    for (const t of todos ?? []) {
      if (t.subject) continue
      const status = plannedTodoStatus(t, viewDate, today)
      if (status) items.push({ todo: t, status })
    }
    return items
  }, [todos, viewDate, today])

  // A tracked seminar left uncovered once its day has passed doesn't linger on
  // Today — it settles straight into a recorded absence instead.
  useEffect(() => {
    if (!lessons) return
    const pending = pendingSeminarAbsences(lessons, today)
    for (const { lesson, date } of pending) {
      void db.lessons.update(lesson.id, toggledAbsence(lesson, date))
    }
  }, [lessons, today])

  // A recurring due todo re-arms for its next cycle once the one just ticked
  // has fully passed — see `dueRolloverPatch`.
  useEffect(() => {
    if (!todos) return
    for (const t of todos) {
      const patch = dueRolloverPatch(t, today)
      if (patch) void db.todos.update(t.id, patch)
    }
  }, [todos, today])

  const folderOf = useMemo(() => {
    const m = new Map<string, TodoFolder | null>()
    for (const s of sections) for (const t of s.todos) m.set(t.id, s.folder)
    return m
  }, [sections])

  // A folder deleted while open leaves no tile behind, so fall back to the
  // overview rather than a blank screen.
  const open = tab === 'all' ? (sections.find((s) => s.key === openKey) ?? null) : null

  // Where the floating "+" drops a todo: the open folder, else the catch-all
  // ("Others"), else the first tile. Null only until the seed lands.
  const defaultFolderId =
    (folders ?? []).find((f) => f.isDefault)?.id ?? (folders ?? [])[0]?.id ?? null

  function addTodo() {
    setTodoEditor({
      todo: null,
      folderId: open ? (open.folder?.id ?? null) : defaultFolderId,
      // Adding from the Today tab means "today" — that is what the tab is for.
      plannedFor: tab === 'today' ? today : null,
    })
  }

  async function toggleDone(todo: Todo) {
    await db.todos.update(todo.id, {
      done: !todo.done,
      doneAt: todo.done ? undefined : Date.now(),
    })
  }

  /** Correct a past (or preview a future) day's class occurrence from the day pager. */
  async function toggleDayOccurrence(lesson: Lesson, covered: boolean) {
    await db.lessons.update(lesson.id, coverPatch(lesson, viewDate, covered))
  }

  /**
   * Mark a subject todo's cycle on `viewDate` done or not, from the day
   * pager. A one-off todo's `dueBy` never moves, so this is just its normal
   * done flag. For a recurring one, `viewDate` equalling the current `dueBy`
   * means this *is* the live, still-open cycle — ticking it here is exactly
   * ticking it on Today, and the existing `dueRolloverPatch` effect logs it
   * into `completedDates` and advances `dueBy` on the next render, same as
   * always. An *earlier* cycle (one a later `dueBy` has already superseded)
   * only needs its own log entry touched — `dueBy` stays where it is.
   */
  async function toggleDayTodo(todo: Todo, done: boolean) {
    if (todo.repeatWeekday === undefined || viewDate === todo.dueBy) {
      await db.todos.update(todo.id, { done, doneAt: done ? Date.now() : undefined })
      return
    }
    const dates = todo.completedDates ?? []
    await db.todos.update(todo.id, {
      completedDates: done ? [...dates, viewDate] : dates.filter((d) => d !== viewDate),
    })
  }

  /**
   * Mark a plain planned todo done or not from the day pager, backdated to
   * `viewDate` rather than stamped "now" — `plannedTodoStatus` reads a done
   * todo's day straight off `doneAt`, so ticking it while looking at last
   * Tuesday has to actually date it to last Tuesday, or the report wouldn't
   * show that row flipping to done on the day you were just looking at.
   */
  async function togglePlannedDay(todo: Todo, done: boolean) {
    await db.todos.update(todo.id, {
      done,
      doneAt: done ? fromISODate(viewDate).getTime() : undefined,
    })
  }

  /**
   * Pull a task onto Today, or drop it back to its folder. A task already
   * pushed ahead to a later day is *not* on Today, so the sun pulls it back
   * here rather than unplanning it.
   */
  async function togglePlanned(todo: Todo) {
    const on = !!todo.plannedFor && todo.plannedFor <= today
    await db.todos.update(todo.id, planPatch(todo, on ? null : today))
  }

  /** Plan the task for a day of the user's choosing; null takes it off the plan. */
  async function planOn(todo: Todo, iso: string | null) {
    await db.todos.update(todo.id, planPatch(todo, iso))
  }

  /** "Not today after all" — park the task on tomorrow's list. */
  async function pushToTomorrow(todo: Todo) {
    await db.todos.update(todo.id, planPatch(todo, nextDay(today)))
  }

  async function saveTodo(draft: TodoDraft) {
    const target = todoEditor?.todo
    if (target) {
      await db.todos.update(target.id, {
        title: draft.title,
        note: draft.note || undefined,
        folderId: draft.folderId ?? undefined,
        dueBy: draft.dueBy ?? undefined,
        subject: draft.subject ?? undefined,
        repeatWeekday: draft.repeatWeekday ?? undefined,
        ...planPatch(target, draft.plannedFor),
      })
    } else {
      // Order is per folder, so a new todo goes last inside its own tile.
      const siblings = (todos ?? []).filter((t) => (t.folderId ?? null) === draft.folderId)
      const maxOrder = siblings.reduce((m, t) => Math.max(m, t.order), -1)
      await db.todos.add({
        id: newId(),
        folderId: draft.folderId ?? undefined,
        title: draft.title,
        note: draft.note || undefined,
        done: false,
        dueBy: draft.dueBy ?? undefined,
        subject: draft.subject ?? undefined,
        repeatWeekday: draft.repeatWeekday ?? undefined,
        ...planPatch(null, draft.plannedFor),
        order: maxOrder + 1,
        ...stamp(),
      })
    }
    setTodoEditor(null)
  }

  async function deleteTodo() {
    const target = todoEditor?.todo
    if (!target) return
    await removeRecord('todos', target.id)
    setTodoEditor(null)
  }

  async function saveFolder(draft: FolderDraft) {
    const target = folderEditor?.folder
    if (target) {
      await db.todoFolders.update(target.id, {
        name: draft.name,
        emoji: draft.emoji || undefined,
      })
    } else {
      const maxOrder = (folders ?? []).reduce((m, f) => Math.max(m, f.order), -1)
      await db.todoFolders.add({
        id: newId(),
        name: draft.name,
        emoji: draft.emoji || undefined,
        order: maxOrder + 1,
        ...stamp(),
      })
    }
    setFolderEditor(null)
  }

  async function reorderFolders(ids: string[]) {
    await db.transaction('rw', db.todoFolders, () =>
      Promise.all(ids.map((id, i) => db.todoFolders.update(id, { order: i }))),
    )
  }

  async function deleteFolder() {
    const target = folderEditor?.folder
    if (!target) return
    const orphans = (todos ?? []).filter((t) => t.folderId === target.id).map((t) => t.id)
    await removeRecords('todos', orphans)
    await removeRecord('todoFolders', target.id)
    setFolderEditor(null)
    setOpenKey(null)
  }

  const editTodo = (t: Todo) =>
    setTodoEditor({ todo: t, folderId: t.folderId ?? null, plannedFor: t.plannedFor ?? null })

  return (
    <>
      {open ? (
        <FolderView
          section={open}
          today={today}
          onBack={() => setOpenKey(null)}
          onEditFolder={() => open.folder && setFolderEditor({ folder: open.folder })}
          onToggleTodo={(t) => void toggleDone(t)}
          onTogglePlanned={(t) => void togglePlanned(t)}
          onPushToTomorrow={(t) => void pushToTomorrow(t)}
          onPlanDate={(t, iso) => void planOn(t, iso)}
          onEditTodo={editTodo}
        />
      ) : (
        <>
          <ScreenHeader
            title="Todos"
            action={
              tab === 'all' && (
                <button
                  type="button"
                  onClick={() => setFolderEditor({ folder: null })}
                  className="rounded-md border border-line px-2.5 py-1 text-sm text-muted hover:border-muted"
                >
                  + folder
                </button>
              )
            }
          />
          <Tabs
            tab={tab}
            onChange={setTab}
            todayCount={
              todayTodos.filter((t) => !t.done).length +
              dueTodos.filter((t) => !t.done).length +
              openSubjectItems
            }
          />

          {tab === 'today' ? (
            <>
              {hasDayPagerContent && (
                <section className="px-4 pb-2">
                  <SubjectDayNav date={viewDate} onChange={setViewDate} />
                  {viewDate === today ? (
                    subjectGroups.length > 0 && (
                      <SubjectList
                        groups={subjectGroups}
                        today={today}
                        onToggleTodo={(t) => void toggleDone(t)}
                        onEditTodo={editTodo}
                      />
                    )
                  ) : (
                    <div className="flex flex-col gap-2">
                      <SubjectDayList
                        groups={dayGroups}
                        onToggleOccurrence={(l, covered) => void toggleDayOccurrence(l, covered)}
                        onToggleTodo={(t, done) => void toggleDayTodo(t, done)}
                      />
                      <PlannedDayList
                        items={plannedDayItems}
                        folderOf={folderOf}
                        onToggle={(t, done) => void togglePlannedDay(t, done)}
                      />
                    </div>
                  )}
                </section>
              )}
              {dueTodos.length > 0 && (
                <DuesList
                  todos={dueTodos}
                  today={today}
                  folderOf={folderOf}
                  onToggle={(t) => void toggleDone(t)}
                  onEdit={editTodo}
                />
              )}
              {todayTodos.length === 0 ? (
                <EmptyState
                  title="Nothing planned for today."
                  hint={'Tap ☀︎ on any task to pull it in, or add one with "+".'}
                />
              ) : (
                <ul className="px-4 pb-28">
                  {todayTodos.map((t) => (
                    <TodoRow
                      key={t.id}
                      todo={t}
                      today={today}
                      folder={folderOf.get(t.id) ?? null}
                      onToggle={() => void toggleDone(t)}
                      onTogglePlanned={() => void togglePlanned(t)}
                      onPushToTomorrow={() => void pushToTomorrow(t)}
                      onPlanDate={(iso) => void planOn(t, iso)}
                      onEdit={() => editTodo(t)}
                    />
                  ))}
                </ul>
              )}
            </>
          ) : sections.length === 0 ? (
            <EmptyState
              title="No folders yet."
              hint={'Make one with "+ folder", then fill it with tasks.'}
            />
          ) : (
            <FolderTiles
              sections={sections}
              onOpen={setOpenKey}
              onReorder={(ids) => void reorderFolders(ids)}
            />
          )}
        </>
      )}

      <AddButton onClick={addTodo} />

      {todoEditor && (
        <TodoEditor
          todo={todoEditor.todo}
          folders={folders ?? []}
          subjects={lessonSubjects}
          initialFolderId={todoEditor.folderId}
          initialPlannedFor={todoEditor.plannedFor}
          onSave={(d) => void saveTodo(d)}
          onDelete={() => void deleteTodo()}
          onClose={() => setTodoEditor(null)}
        />
      )}

      {folderEditor && (
        <FolderEditor
          folder={folderEditor.folder}
          todoCount={(todos ?? []).filter((t) => t.folderId === folderEditor.folder?.id).length}
          onSave={(d) => void saveFolder(d)}
          onDelete={() => void deleteFolder()}
          onClose={() => setFolderEditor(null)}
        />
      )}
    </>
  )
}

/**
 * Folders in their own order, each with its todos; the loose ones follow in an
 * "Unsorted" tile that is only built when it has something in it.
 */
function buildSections(folders: TodoFolder[], todos: Todo[]): Section[] {
  const sections: Section[] = folders.map((f) => ({
    key: f.id,
    folder: f,
    todos: sortTodos(todos.filter((t) => t.folderId === f.id)),
  }))
  const loose = sortTodos(todos.filter((t) => !t.folderId))
  if (loose.length) sections.push({ key: UNSORTED, folder: null, todos: loose })
  return sections
}

/** Open tasks in their manual order; ticked ones sink to the bottom, newest first. */
function sortTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    if (a.done) return (b.doneAt ?? 0) - (a.doneAt ?? 0)
    return a.order - b.order
  })
}

/**
 * Today's todos, grouped by folder (in folder order) and alphabetical within
 * one — sorting the flattened list by each task's own per-folder `order`
 * would let two folders' overlapping numbers interleave, which loses the
 * grouping. Ticked ones still sink to the bottom of their folder, newest
 * first, same as `sortTodos`. A due todo lives in `DuesList` instead, and a
 * subject-tagged one lives in `SubjectList`, so both are excluded here to
 * avoid showing twice.
 */
function sortToday(sections: Section[], today: string): Todo[] {
  return sections.flatMap((s) =>
    s.todos
      .filter((t) => isOnToday(t, today) && !t.dueBy && !t.subject)
      .sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1
        if (a.done) return (b.doneAt ?? 0) - (a.doneAt ?? 0)
        return a.title.localeCompare(b.title)
      }),
  )
}

/**
 * Due todos, soonest deadline first; ticked ones (today only) sink to the
 * bottom. A subject-tagged one lives in `SubjectList` instead, so it's
 * excluded here to avoid showing twice.
 */
function sortDues(todos: Todo[], today: string): Todo[] {
  return todos
    .filter((t) => isDue(t, today) && !t.subject)
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1
      if (a.done) return (b.doneAt ?? 0) - (a.doneAt ?? 0)
      return a.dueBy!.localeCompare(b.dueBy!)
    })
}

function folderLabel(folder: TodoFolder | null): string {
  return folder ? folder.name : 'Unsorted'
}

/** The Today / All switch, with today's outstanding count on the left tab. */
function Tabs({
  tab,
  onChange,
  todayCount,
}: {
  tab: Tab
  onChange: (t: Tab) => void
  todayCount: number
}) {
  return (
    <div className="mb-3 flex gap-1.5 px-4">
      <TabButton active={tab === 'today'} onClick={() => onChange('today')}>
        Today {todayCount > 0 && <span className="font-mono text-[11px]">{todayCount}</span>}
      </TabButton>
      <TabButton active={tab === 'all'} onClick={() => onChange('all')}>
        All
      </TabButton>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-9 flex-1 rounded-md border text-sm transition-colors',
        active ? 'border-brass-dim bg-brass-dim/30 text-parchment' : 'border-line text-muted',
      )}
    >
      {children}
    </button>
  )
}

/** px — matches the grid's `gap-3` below; kept in sync by hand. */
const TILE_GAP = 12

type FolderDrag = { key: string; dx: number; dy: number; from: number; to: number }

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const copy = arr.slice()
  copy.splice(to, 0, copy.splice(from, 1)[0])
  return copy
}

/**
 * The All tab's overview: tiles flow side by side and wrap onto the next line
 * when they no longer fit, so the column count follows the viewport width
 * rather than a breakpoint — two on a phone, more on a wide screen.
 *
 * Real folders can be dragged to reorder, same spirit as the routine columns
 * (`RoutineGrid`): the grabbed tile follows the pointer 1:1 while the rest
 * slide live into their target slot (`visualFolders` = `arrayMove`), and the
 * overlay is held after drop until the persisted order catches up. It is a 2D
 * wrapping grid rather than a single row, so the slot math tracks row *and*
 * column — `cols` is measured from the live layout (not assumed) since it
 * follows the viewport, not a breakpoint. The "Unsorted" tile, when present,
 * has no `order` of its own and always trails the real folders, so it never
 * takes part in the drag.
 */
function FolderTiles({
  sections,
  onOpen,
  onReorder,
}: {
  sections: Section[]
  onOpen: (key: string) => void
  /** new folder id order after a drag */
  onReorder: (ids: string[]) => void
}) {
  const folderSections = useMemo(() => sections.filter((s) => s.folder), [sections])
  const tail = useMemo(() => sections.filter((s) => !s.folder), [sections])

  const grabRef = useRef<{
    key: string
    startX: number
    startY: number
    from: number
    cellW: number
    cellH: number
    cols: number
    moved: boolean
  } | null>(null)
  const dragStateRef = useRef<FolderDrag | null>(null)
  const settleRef = useRef<string | null>(null)
  const didDragRef = useRef(false)
  const [drag, setDragRaw] = useState<FolderDrag | null>(null)

  function setDrag(next: FolderDrag | null) {
    dragStateRef.current = next
    setDragRaw(next)
  }

  const visualFolders = useMemo(
    () =>
      drag && drag.from !== drag.to
        ? arrayMove(folderSections, drag.from, drag.to)
        : folderSections,
    [folderSections, drag],
  )

  // Once the persisted order matches the drop target, drop the drag overlay.
  useEffect(() => {
    if (settleRef.current && folderSections.map((s) => s.key).join('|') === settleRef.current) {
      settleRef.current = null
      grabRef.current = null
      dragStateRef.current = null
      setDragRaw(null)
    }
  }, [folderSections])

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>, key: string) {
    if (folderSections.length < 2) return
    const rect = e.currentTarget.getBoundingClientRect()
    // How many tiles share the top row right now — the column count follows
    // the viewport, not a breakpoint, so it can't be assumed, only measured.
    const grid = e.currentTarget.closest('[data-folder-grid]')
    const tiles = grid ? Array.from(grid.querySelectorAll<HTMLElement>('[data-folder-tile]')) : []
    const firstTop = tiles[0]?.getBoundingClientRect().top ?? 0
    const cols =
      tiles.filter((t) => Math.abs(t.getBoundingClientRect().top - firstTop) < 1).length || 1
    grabRef.current = {
      key,
      startX: e.clientX,
      startY: e.clientY,
      from: folderSections.findIndex((s) => s.key === key),
      cellW: rect.width || 144,
      cellH: rect.height || 144,
      cols,
      moved: false,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    const g = grabRef.current
    if (!g) return
    const dx = e.clientX - g.startX
    const dy = e.clientY - g.startY
    if (!g.moved && Math.hypot(dx, dy) < 6) return
    g.moved = true
    didDragRef.current = true
    e.preventDefault()
    const colFrom = g.from % g.cols
    const rowFrom = Math.floor(g.from / g.cols)
    const col = Math.max(0, Math.min(g.cols - 1, colFrom + Math.round(dx / (g.cellW + TILE_GAP))))
    const row = Math.max(0, rowFrom + Math.round(dy / (g.cellH + TILE_GAP)))
    const to = Math.max(0, Math.min(folderSections.length - 1, row * g.cols + col))
    setDrag({ key: g.key, dx, dy, from: g.from, to })
  }

  function endDrag() {
    const g = grabRef.current
    const cur = dragStateRef.current
    if (!g?.moved || !cur || cur.to === cur.from) {
      grabRef.current = null
      setDrag(null)
      return
    }
    const ids = arrayMove(folderSections, cur.from, cur.to).map((s) => s.key)
    settleRef.current = ids.join('|')
    // hold the reordered view; the grabbed tile rests in its new slot until
    // the persisted order catches up, so `grabRef` stays alive for its
    // geometry (`cols`/`cellW`/`cellH`) rather than being cleared here.
    const colFrom = cur.from % g.cols
    const rowFrom = Math.floor(cur.from / g.cols)
    const colTo = cur.to % g.cols
    const rowTo = Math.floor(cur.to / g.cols)
    setDrag({
      ...cur,
      dx: (colTo - colFrom) * (g.cellW + TILE_GAP),
      dy: (rowTo - rowFrom) * (g.cellH + TILE_GAP),
    })
    onReorder(ids)
    // safety net if the persisted order never comes back as expected
    window.setTimeout(() => {
      if (settleRef.current === ids.join('|')) {
        settleRef.current = null
        grabRef.current = null
        setDrag(null)
      }
    }, 400)
  }

  const cols = grabRef.current?.cols

  return (
    <div
      data-folder-grid
      className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3 px-4 pb-28"
    >
      {visualFolders.map((s) => {
        let style: React.CSSProperties | undefined
        if (drag?.key === s.key && cols) {
          const colFrom = drag.from % cols
          const rowFrom = Math.floor(drag.from / cols)
          const colTo = drag.to % cols
          const rowTo = Math.floor(drag.to / cols)
          const cellW = grabRef.current!.cellW
          const cellH = grabRef.current!.cellH
          const shiftX = (colTo - colFrom) * (cellW + TILE_GAP)
          const shiftY = (rowTo - rowFrom) * (cellH + TILE_GAP)
          style = {
            transform: `translate(${drag.dx - shiftX}px, ${drag.dy - shiftY}px)`,
            position: 'relative',
            zIndex: 40,
          }
        }
        return (
          <FolderTile
            key={s.key}
            section={s}
            style={style}
            draggable
            onOpen={() => onOpen(s.key)}
            onPointerDown={(e) => onPointerDown(e, s.key)}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onClick={() => {
              if (didDragRef.current) {
                didDragRef.current = false
                return
              }
              onOpen(s.key)
            }}
          />
        )
      })}
      {tail.map((s) => (
        <FolderTile key={s.key} section={s} onOpen={() => onOpen(s.key)} />
      ))}
    </div>
  )
}

function FolderTile({
  section,
  onOpen,
  style,
  draggable,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onClick,
}: {
  section: Section
  onOpen: () => void
  style?: React.CSSProperties
  /** wired only for real folders — the "Unsorted" tile doesn't reorder */
  draggable?: boolean
  onPointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void
  onPointerMove?: (e: React.PointerEvent) => void
  onPointerUp?: (e: React.PointerEvent) => void
  onPointerCancel?: (e: React.PointerEvent) => void
  onClick?: () => void
}) {
  const { folder, todos } = section
  const open = todos.filter((t) => !t.done).length

  return (
    <button
      type="button"
      data-folder-tile
      style={style}
      onClick={onClick ?? onOpen}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      className={cn(
        'flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-xl border border-line bg-panel p-2 text-center transition-colors hover:border-muted',
        draggable && 'touch-none select-none',
      )}
    >
      <span className="text-3xl leading-none">{folder?.emoji ?? '📥'}</span>
      <span className="w-full truncate text-sm text-parchment">{folderLabel(folder)}</span>
      <span className="font-mono text-[11px] text-muted">
        {todos.length === 0 ? 'empty' : open === 0 ? 'all done' : `${open} open`}
      </span>
    </button>
  )
}

/** One folder's task list, opened from its tile on the All tab. */
function FolderView({
  section,
  today,
  onBack,
  onEditFolder,
  onToggleTodo,
  onTogglePlanned,
  onPushToTomorrow,
  onPlanDate,
  onEditTodo,
}: {
  section: Section
  today: string
  onBack: () => void
  onEditFolder: () => void
  onToggleTodo: (t: Todo) => void
  onTogglePlanned: (t: Todo) => void
  onPushToTomorrow: (t: Todo) => void
  onPlanDate: (t: Todo, iso: string | null) => void
  onEditTodo: (t: Todo) => void
}) {
  const { folder, todos } = section

  return (
    <>
      <header className="flex items-center gap-1 px-2 pb-3 pt-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to folders"
          className="h-9 w-9 shrink-0 rounded-md text-lg text-muted hover:text-parchment"
        >
          ←
        </button>
        <h1 className="min-w-0 flex-1 truncate font-display text-2xl font-medium">
          {folder?.emoji ? `${folder.emoji} ` : ''}
          {folderLabel(folder)}
        </h1>
        {folder && (
          <button
            type="button"
            onClick={onEditFolder}
            className="shrink-0 rounded-md border border-line px-2.5 py-1 text-sm text-muted hover:border-muted"
          >
            Edit
          </button>
        )}
      </header>

      {todos.length === 0 ? (
        <EmptyState title="Nothing here yet." hint={'Add a task with "+".'} />
      ) : (
        <ul className="px-4 pb-28">
          {todos.map((t) => (
            <TodoRow
              key={t.id}
              todo={t}
              today={today}
              onToggle={() => onToggleTodo(t)}
              onTogglePlanned={() => onTogglePlanned(t)}
              onPushToTomorrow={() => onPushToTomorrow(t)}
              onPlanDate={(iso) => onPlanDate(t, iso)}
              onEdit={() => onEditTodo(t)}
            />
          ))}
        </ul>
      )}
    </>
  )
}

function TodoRow({
  todo,
  today,
  folder,
  onToggle,
  onTogglePlanned,
  onPushToTomorrow,
  onPlanDate,
  onEdit,
}: {
  todo: Todo
  today: string
  /** shown as a badge on the Today tab, where the rows come from all folders */
  folder?: TodoFolder | null
  onToggle: () => void
  onTogglePlanned: () => void
  onPushToTomorrow: () => void
  /** null clears the plan — the picker's field was emptied */
  onPlanDate: (iso: string | null) => void
  onEdit: () => void
}) {
  // Lit only for a task that is actually on Today — one pushed ahead is
  // planned, but not for now.
  const planned = !!todo.plannedFor && todo.plannedFor <= today
  const ahead = isPlannedAhead(todo, today)

  return (
    <li className="flex items-start gap-1 border-b border-line-soft last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-label={todo.done ? 'Mark as not done' : 'Mark as done'}
        className="flex h-12 w-9 shrink-0 items-center justify-center"
      >
        <span
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded border-[1.5px] text-xs',
            todo.done ? 'border-done bg-done-dim text-parchment' : 'border-brass-dim',
          )}
        >
          {todo.done && '✓'}
        </span>
      </button>
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 py-3 pr-1 text-left text-sm">
        <span className={cn('block', todo.done ? 'text-dim line-through' : 'text-parchment')}>
          {todo.title}
        </span>
        {(todo.note ||
          folder ||
          todo.subject ||
          ahead ||
          isCarriedOver(todo, today) ||
          todo.dueBy) && (
          <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xs text-muted">
            {todo.subject && <span>{todo.subject}</span>}
            {folder && <span>{folder.emoji ? `${folder.emoji} ${folder.name}` : folder.name}</span>}
            {isCarriedOver(todo, today) && (
              <span className="text-missed">
                carried over since {formatShort(fromISODate(plannedSinceOf(todo)!))}
              </span>
            )}
            {ahead && <span className="text-brass-dim">{aheadLabel(todo, today)}</span>}
            {todo.dueBy && (
              <span className={isOverdue(todo, today) ? 'text-missed' : 'text-brass-dim'}>
                {todo.repeatWeekday !== undefined && '↻ '}
                {isOverdue(todo, today) ? 'overdue since ' : 'due '}
                {formatShort(fromISODate(todo.dueBy))}
              </span>
            )}
            {todo.note && <span>{todo.note}</span>}
          </span>
        )}
      </button>
      {/* The sun is the "do it today" gesture, on every row wherever it is
          listed; tapping a lit one puts the task back to Someday. Text
          presentation (U+FE0E) so the glyphs take the palette instead of the
          platform's own colour emoji. */}
      <button
        type="button"
        onClick={onTogglePlanned}
        aria-label={planned ? 'Remove from today' : 'Do today'}
        title={planned ? 'Remove from today' : 'Do today'}
        className="flex h-12 w-9 shrink-0 items-center justify-center"
      >
        <span className={cn(ACTION_DOT, planned ? ACTION_ON : ACTION_OFF)}>☀︎</span>
      </button>
      {/* "Not today" — one tap parks the task on tomorrow's list. Hidden on a
          ticked task (there is nothing left to postpone), but it still holds
          its slot so the rows stay aligned. */}
      <button
        type="button"
        onClick={onPushToTomorrow}
        disabled={todo.done}
        aria-label="Move to tomorrow"
        title="Move to tomorrow"
        className={cn(
          'flex h-12 w-9 shrink-0 items-center justify-center',
          todo.done && 'invisible',
        )}
      >
        <span className={cn(ACTION_DOT, ACTION_OFF)}>→</span>
      </button>
      {/* Any other day: the platform's own date picker, opened by a transparent
          <input type="date"> laid over the button — it already knows the phone's
          locale, first weekday and gestures, so there is no calendar to build.
          Clearing the field takes the task off the plan. */}
      <label
        title="Plan for a date"
        className="relative flex h-12 w-9 shrink-0 items-center justify-center"
      >
        <span className={cn(ACTION_DOT, ahead ? ACTION_ON : ACTION_OFF)}>🗓︎</span>
        <input
          type="date"
          value={todo.plannedFor ?? ''}
          aria-label="Plan for a date"
          onClick={(e) => {
            // Chrome opens the picker from anywhere on the field this way;
            // elsewhere tapping the field does it by itself.
            const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void }
            try {
              el.showPicker?.()
            } catch {
              /* refused without a gesture — the plain tap still opens it */
            }
          }}
          onChange={(e) => onPlanDate(e.target.value || null)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
    </li>
  )
}

/** The three round row actions share one look; only the lit/unlit state differs. */
const ACTION_DOT =
  'flex h-7 w-7 items-center justify-center rounded-full border text-sm leading-none transition-colors'
const ACTION_ON = 'border-brass-dim bg-brass-dim/30 text-brass'
const ACTION_OFF = 'border-line text-dim hover:text-muted'

/** How far ahead a pushed task sits: tomorrow by name, anything further by date. */
function aheadLabel(todo: Todo, today: string): string {
  return todo.plannedFor === nextDay(today)
    ? 'tomorrow'
    : formatShort(fromISODate(todo.plannedFor!))
}

/** Floating "+" — the primary way to add a todo, anchored above the nav bar. */
function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40"
      style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto flex max-w-2xl justify-end px-4">
        <button
          type="button"
          onClick={onClick}
          aria-label="New todo"
          className="pointer-events-auto h-14 w-14 rounded-full border border-brass-dim bg-brass-dim/40 text-2xl leading-none text-parchment shadow-lg"
        >
          +
        </button>
      </div>
    </div>
  )
}
