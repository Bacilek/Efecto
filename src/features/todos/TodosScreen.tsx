import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, type Todo, type TodoFolder } from '@/db/db'
import { cn } from '@/lib/cn'
import { todayISO } from '@/lib/date'
import { ScreenHeader } from '@/ui/ScreenHeader'
import { EmptyState } from '@/ui/EmptyState'
import { TodoEditor, type TodoDraft } from './TodoEditor'
import { FolderEditor, type FolderDraft } from './FolderEditor'
import { isCarriedOver, isOnToday } from './today'

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

  const folders = useLiveQuery(() => db.todoFolders.orderBy('order').toArray(), [])
  const todos = useLiveQuery(() => db.todos.toArray(), [])

  const today = todayISO()

  const sections = useMemo<Section[]>(
    () => buildSections(folders ?? [], todos ?? []),
    [folders, todos],
  )

  // Today's list follows the folder order, so it reads in the same sequence as
  // the tiles; ticked tasks sink to the bottom exactly as they do in a folder.
  const todayTodos = useMemo(
    () => sortTodos(sections.flatMap((s) => s.todos).filter((t) => isOnToday(t, today))),
    [sections, today],
  )

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

  /** Pull a task onto Today, or drop it back to its folder. */
  async function togglePlanned(todo: Todo) {
    await db.todos.update(todo.id, { plannedFor: todo.plannedFor ? undefined : today })
  }

  async function saveTodo(draft: TodoDraft) {
    const target = todoEditor?.todo
    if (target) {
      await db.todos.update(target.id, {
        title: draft.title,
        note: draft.note || undefined,
        folderId: draft.folderId ?? undefined,
        plannedFor: draft.plannedFor ?? undefined,
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
        plannedFor: draft.plannedFor ?? undefined,
        order: maxOrder + 1,
        createdAt: Date.now(),
      })
    }
    setTodoEditor(null)
  }

  async function deleteTodo() {
    const target = todoEditor?.todo
    if (!target) return
    await db.todos.delete(target.id)
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
        createdAt: Date.now(),
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
    await db.transaction('rw', db.todoFolders, db.todos, async () => {
      await db.todos.filter((t) => t.folderId === target.id).delete()
      await db.todoFolders.delete(target.id)
    })
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
          <Tabs tab={tab} onChange={setTab} todayCount={todayTodos.filter((t) => !t.done).length} />

          {tab === 'today' ? (
            todayTodos.length === 0 ? (
              <EmptyState
                title="Nothing planned for today."
                hint={'Pull tasks in from "All", or add one with "+".'}
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
                    onEdit={() => editTodo(t)}
                  />
                ))}
              </ul>
            )
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
      drag && drag.from !== drag.to ? arrayMove(folderSections, drag.from, drag.to) : folderSections,
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
  onEditTodo,
}: {
  section: Section
  today: string
  onBack: () => void
  onEditFolder: () => void
  onToggleTodo: (t: Todo) => void
  onTogglePlanned: (t: Todo) => void
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
  onEdit,
}: {
  todo: Todo
  today: string
  /** shown as a badge on the Today tab, where the rows come from all folders */
  folder?: TodoFolder | null
  onToggle: () => void
  onTogglePlanned: () => void
  onEdit: () => void
}) {
  const planned = !!todo.plannedFor

  return (
    <li className="flex items-start gap-2 border-b border-line-soft last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-label={todo.done ? 'Mark as not done' : 'Mark as done'}
        className="flex h-12 w-10 shrink-0 items-center justify-center"
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
        {(todo.note || folder || isCarriedOver(todo, today)) && (
          <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xs text-muted">
            {folder && <span>{folder.emoji ? `${folder.emoji} ${folder.name}` : folder.name}</span>}
            {isCarriedOver(todo, today) && <span className="text-missed">carried over</span>}
            {todo.note && <span>{todo.note}</span>}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={onTogglePlanned}
        aria-label={planned ? 'Remove from today' : 'Do today'}
        className={cn(
          'flex h-12 w-10 shrink-0 items-center justify-center text-sm',
          planned ? 'text-brass' : 'text-dim',
        )}
      >
        ★
      </button>
    </li>
  )
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
