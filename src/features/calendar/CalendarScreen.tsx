import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, stamp, type Todo } from '@/db/db'
import { removeRecord } from '@/db/remove'
import { toISODate } from '@/lib/date'
import { minutesToTime } from '@/lib/time'
import { ScreenHeader } from '@/ui/ScreenHeader'
import { TodoEditor, type TodoDraft } from '@/features/todos/TodoEditor'
import { planPatch } from '@/features/todos/today'
import { AllDayStrip } from './AllDayStrip'
import { CalendarGrid } from './CalendarGrid'
import { CalendarWeekNav } from './CalendarWeekNav'
import { useCalendarWeek } from './useCalendarWeek'
import { windowFor } from './layout'

/** `{ todo: null }` opens the sheet for a new todo in the tapped day/slot. */
interface EditorTarget {
  todo: Todo | null
  plannedFor: string
  allDay?: boolean
  startTime?: string | null
  endTime?: string | null
}

export function CalendarScreen() {
  const [editor, setEditor] = useState<EditorTarget | null>(null)
  const [expanded, setExpanded] = useState(false)
  const week = useCalendarWeek()
  const todos = useLiveQuery(() => db.todos.toArray(), [])
  const folders = useLiveQuery(() => db.todoFolders.orderBy('order').toArray(), [])
  const lessons = useLiveQuery(() => db.lessons.toArray(), [])
  const win = useMemo(() => windowFor(expanded), [expanded])

  // The distinct subject codes the timetable knows about, for the editor's
  // Subject picker — same list `TodosScreen` builds.
  const lessonSubjects = useMemo(
    () => [...new Set((lessons ?? []).map((l) => l.name))].sort((a, b) => a.localeCompare(b)),
    [lessons],
  )

  // Where a todo added here lands: the catch-all folder, else the first one.
  const defaultFolderId =
    (folders ?? []).find((f) => f.isDefault)?.id ?? (folders ?? [])[0]?.id ?? null

  function editTodo(t: Todo) {
    setEditor({
      todo: t,
      plannedFor: t.plannedFor!,
      allDay: t.allDay,
      startTime: t.startTime,
      endTime: t.endTime,
    })
  }

  async function saveTodo(draft: TodoDraft) {
    const target = editor?.todo
    if (target) {
      await db.todos.update(target.id, {
        title: draft.title,
        note: draft.note || undefined,
        folderId: draft.folderId ?? undefined,
        dueBy: draft.dueBy ?? undefined,
        subject: draft.subject ?? undefined,
        repeatWeekday: draft.repeatWeekday ?? undefined,
        allDay: draft.allDay || undefined,
        startTime: draft.startTime ?? undefined,
        endTime: draft.endTime ?? undefined,
        ...planPatch(target, draft.plannedFor),
      })
    } else {
      // Order is per folder, same as a todo added from the Todos tab.
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
        allDay: draft.allDay || undefined,
        startTime: draft.startTime ?? undefined,
        endTime: draft.endTime ?? undefined,
        ...planPatch(null, draft.plannedFor),
        order: maxOrder + 1,
        ...stamp(),
      })
    }
    setEditor(null)
  }

  async function deleteTodo() {
    const target = editor?.todo
    if (!target) return
    await removeRecord('todos', target.id)
    setEditor(null)
  }

  return (
    <>
      <ScreenHeader title="Calendar" />

      <CalendarWeekNav week={week} />

      <AllDayStrip
        todos={todos ?? []}
        dates={week.dates}
        showToday={week.isCurrent}
        onTapTodo={editTodo}
      />

      <CalendarGrid
        todos={todos ?? []}
        dates={week.dates}
        win={win}
        expanded={expanded}
        onToggleExpand={() => setExpanded((e) => !e)}
        showNow={week.isCurrent}
        onTapTodo={editTodo}
        onTapSlot={(day, startMinutes) => {
          setEditor({
            todo: null,
            plannedFor: toISODate(week.dates[day]),
            allDay: false,
            startTime: minutesToTime(startMinutes),
            endTime: minutesToTime(Math.min(startMinutes + 60, win.end)),
          })
        }}
      />

      <p className="px-4 pb-8 pt-1 text-center text-[11px] text-dim">
        Tap a todo to edit it, or an empty slot to plan one.
      </p>

      {editor && (
        <TodoEditor
          todo={editor.todo}
          folders={folders ?? []}
          subjects={lessonSubjects}
          initialFolderId={editor.todo ? (editor.todo.folderId ?? null) : defaultFolderId}
          initialPlannedFor={editor.plannedFor}
          initialAllDay={editor.allDay}
          initialStartTime={editor.startTime}
          initialEndTime={editor.endTime}
          onSave={(d) => void saveTodo(d)}
          onDelete={() => void deleteTodo()}
          onClose={() => setEditor(null)}
        />
      )}
    </>
  )
}
