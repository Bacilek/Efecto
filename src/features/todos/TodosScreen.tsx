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

/** One rendered section: a folder, or the fallback bucket when `folder` is null. */
interface Section {
  key: string
  folder: TodoFolder | null
  todos: Todo[]
}

export function TodosScreen() {
  const [todoEditor, setTodoEditor] = useState<TodoTarget>(null)
  const [folderEditor, setFolderEditor] = useState<FolderTarget>(null)
  const [collapsed, setCollapsed] = useState<string[]>([])

  const folders = useLiveQuery(() => db.todoFolders.orderBy('order').toArray(), [])
  const todos = useLiveQuery(() => db.todos.toArray(), [])

  const sections = useMemo<Section[]>(
    () => buildSections(folders ?? [], todos ?? []),
    [folders, todos],
  )

  // Only the fallback bucket can be empty-and-hidden, so "nothing at all" is
  // exactly "no folders and no loose todos".
  const isEmpty = folders?.length === 0 && todos?.length === 0

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
      // Order is per folder, so a new todo goes last inside its own section.
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
  }

  return (
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

      {isEmpty ? (
        <EmptyState title="No todos yet." hint={'Make a folder, then add tasks to it with "+".'} />
      ) : (
        <div className="px-4 pb-28">
          {sections.map((s) => (
            <FolderSection
              key={s.key}
              section={s}
              collapsed={collapsed.includes(s.key)}
              onToggleCollapse={() =>
                setCollapsed((prev) =>
                  prev.includes(s.key) ? prev.filter((k) => k !== s.key) : [...prev, s.key],
                )
              }
              onEditFolder={() => s.folder && setFolderEditor({ folder: s.folder })}
              onAddTodo={() => setTodoEditor({ todo: null, folderId: s.folder?.id ?? null })}
              onToggleTodo={(t) => void toggleDone(t)}
              onEditTodo={(t) => setTodoEditor({ todo: t, folderId: t.folderId ?? null })}
            />
          ))}
        </div>
      )}

      <AddButton
        onClick={() => setTodoEditor({ todo: null, folderId: sections[0]?.folder?.id ?? null })}
      />

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
 * "Unsorted" bucket that is only rendered when it has something in it.
 */
function buildSections(folders: TodoFolder[], todos: Todo[]): Section[] {
  const sections: Section[] = folders.map((f) => ({
    key: f.id,
    folder: f,
    todos: sortTodos(todos.filter((t) => t.folderId === f.id)),
  }))
  const loose = sortTodos(todos.filter((t) => !t.folderId))
  if (loose.length) sections.push({ key: 'unsorted', folder: null, todos: loose })
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

function FolderSection({
  section,
  collapsed,
  onToggleCollapse,
  onEditFolder,
  onAddTodo,
  onToggleTodo,
  onEditTodo,
}: {
  section: Section
  collapsed: boolean
  onToggleCollapse: () => void
  onEditFolder: () => void
  onAddTodo: () => void
  onToggleTodo: (t: Todo) => void
  onEditTodo: (t: Todo) => void
}) {
  const { folder, todos } = section
  const open = todos.filter((t) => !t.done).length

  return (
    <section className="mb-3 overflow-hidden rounded-xl border border-line bg-panel">
      <header className="flex items-center gap-1 border-b border-line-soft px-2 py-2">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand folder' : 'Collapse folder'}
          className="w-6 text-center text-xs text-dim"
        >
          {collapsed ? '▸' : '▾'}
        </button>
        <button
          type="button"
          onClick={folder ? onEditFolder : undefined}
          className="min-w-0 flex-1 truncate text-left text-sm text-parchment"
        >
          {folder ? (folder.emoji ? `${folder.emoji} ${folder.name}` : folder.name) : 'Unsorted'}
        </button>
        <span className="px-1 font-mono text-[11px] text-muted">{open}</span>
        <button
          type="button"
          onClick={onAddTodo}
          aria-label="New todo in this folder"
          className="h-8 w-8 rounded-md border border-line text-muted hover:border-muted"
        >
          +
        </button>
      </header>

      {!collapsed &&
        (todos.length === 0 ? (
          <p className="px-4 py-3 text-xs text-dim">Empty &mdash; add a task with &quot;+&quot;.</p>
        ) : (
          <ul>
            {todos.map((t) => (
              <TodoRow
                key={t.id}
                todo={t}
                onToggle={() => onToggleTodo(t)}
                onEdit={() => onEditTodo(t)}
              />
            ))}
          </ul>
        ))}
    </section>
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
    <li className="flex items-start gap-2 border-b border-line-soft px-2 py-1 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-label={todo.done ? 'Mark as not done' : 'Mark as done'}
        className="flex h-10 w-10 shrink-0 items-center justify-center"
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
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 py-2 pr-1 text-left text-sm">
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
