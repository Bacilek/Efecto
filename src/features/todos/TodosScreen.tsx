import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, type Todo, type TodoFolder } from '@/db/db'
import { cn } from '@/lib/cn'
import { ScreenHeader } from '@/ui/ScreenHeader'
import { EmptyState } from '@/ui/EmptyState'
import { TodoEditor, type TodoDraft } from './TodoEditor'
import { FolderEditor, type FolderDraft } from './FolderEditor'

/** `{ todo: null }` opens the sheet for a new todo in `folderId`. */
type TodoTarget = { todo: Todo | null; folderId: string | null } | null
type FolderTarget = { folder: TodoFolder | null } | null

/** One folder's tile: the folder itself, or the fallback bucket when null. */
interface Section {
  /** folder id, or `UNSORTED` for the loose todos */
  key: string
  folder: TodoFolder | null
  todos: Todo[]
}

const UNSORTED = 'unsorted'

export function TodosScreen() {
  const [todoEditor, setTodoEditor] = useState<TodoTarget>(null)
  const [folderEditor, setFolderEditor] = useState<FolderTarget>(null)
  /** which folder is open; null = the tile overview */
  const [openKey, setOpenKey] = useState<string | null>(null)

  const folders = useLiveQuery(() => db.todoFolders.orderBy('order').toArray(), [])
  const todos = useLiveQuery(() => db.todos.toArray(), [])

  const sections = useMemo<Section[]>(
    () => buildSections(folders ?? [], todos ?? []),
    [folders, todos],
  )

  // A folder deleted while open (or an Unsorted bucket emptied into one) leaves
  // no tile behind, so fall back to the overview rather than a blank screen.
  const open = sections.find((s) => s.key === openKey) ?? null

  // Where the floating "+" drops a todo: the open folder, else the catch-all
  // ("Others"), else the first tile. Null only until the seed lands.
  const defaultFolderId =
    (folders ?? []).find((f) => f.isDefault)?.id ?? (folders ?? [])[0]?.id ?? null
  const addFolderId = open ? (open.folder?.id ?? null) : defaultFolderId

  async function toggleDone(todo: Todo) {
    await db.todos.update(todo.id, {
      done: !todo.done,
      doneAt: todo.done ? undefined : Date.now(),
    })
  }

  async function saveTodo(draft: TodoDraft) {
    const target = todoEditor?.todo
    if (target) {
      await db.todos.update(target.id, {
        title: draft.title,
        note: draft.note || undefined,
        folderId: draft.folderId ?? undefined,
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

  return (
    <>
      {open ? (
        <FolderView
          section={open}
          onBack={() => setOpenKey(null)}
          onEditFolder={() => open.folder && setFolderEditor({ folder: open.folder })}
          onToggleTodo={(t) => void toggleDone(t)}
          onEditTodo={(t) => setTodoEditor({ todo: t, folderId: t.folderId ?? null })}
        />
      ) : (
        <>
          <ScreenHeader
            title="Todos"
            action={
              <button
                type="button"
                onClick={() => setFolderEditor({ folder: null })}
                className="rounded-md border border-line px-2.5 py-1 text-sm text-muted hover:border-muted"
              >
                + folder
              </button>
            }
          />
          {sections.length === 0 ? (
            <EmptyState
              title="No folders yet."
              hint={'Make one with "+ folder", then fill it with tasks.'}
            />
          ) : (
            <FolderTiles sections={sections} onOpen={setOpenKey} />
          )}
        </>
      )}

      <AddButton onClick={() => setTodoEditor({ todo: null, folderId: addFolderId })} />

      {todoEditor && (
        <TodoEditor
          todo={todoEditor.todo}
          folders={folders ?? []}
          initialFolderId={todoEditor.folderId}
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

/**
 * The overview: tiles flow side by side and wrap onto the next line when they
 * no longer fit, so the column count follows the viewport width rather than a
 * breakpoint — two on a phone, more on a wide screen.
 */
function FolderTiles({ sections, onOpen }: { sections: Section[]; onOpen: (key: string) => void }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3 px-4 pb-28">
      {sections.map((s) => (
        <FolderTile key={s.key} section={s} onOpen={() => onOpen(s.key)} />
      ))}
    </div>
  )
}

function FolderTile({ section, onOpen }: { section: Section; onOpen: () => void }) {
  const { folder, todos } = section
  const open = todos.filter((t) => !t.done).length

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-line bg-panel p-2 text-center transition-colors hover:border-muted"
    >
      <span className="text-3xl leading-none">{folder?.emoji ?? '📥'}</span>
      <span className="w-full truncate text-sm text-parchment">{folderLabel(folder)}</span>
      <span className="font-mono text-[11px] text-muted">
        {todos.length === 0 ? 'empty' : open === 0 ? 'all done' : `${open} open`}
      </span>
    </button>
  )
}

/** One folder's task list, opened from its tile. */
function FolderView({
  section,
  onBack,
  onEditFolder,
  onToggleTodo,
  onEditTodo,
}: {
  section: Section
  onBack: () => void
  onEditFolder: () => void
  onToggleTodo: (t: Todo) => void
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
              onToggle={() => onToggleTodo(t)}
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
  onToggle,
  onEdit,
}: {
  todo: Todo
  onToggle: () => void
  onEdit: () => void
}) {
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
        {todo.note && <span className="mt-0.5 block text-xs text-muted">{todo.note}</span>}
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
