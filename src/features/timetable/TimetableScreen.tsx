import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, type Lesson } from '@/db/db'
import type { WeekdayIndex } from '@/lib/date'
import { minutesToTime } from '@/lib/time'
import { ScreenHeader } from '@/ui/ScreenHeader'
import { TimetableGrid } from './TimetableGrid'
import { LessonEditor, type LessonDraft } from './LessonEditor'
import { DAY_START } from './layout'

interface EditorTarget {
  /** null = creating a new lesson in the `day` / `start` slot */
  lesson: Lesson | null
  day: WeekdayIndex
  start: string
}

export function TimetableScreen() {
  const [editor, setEditor] = useState<EditorTarget | null>(null)
  const lessons = useLiveQuery(() => db.lessons.toArray(), [])

  async function saveLesson(draft: LessonDraft) {
    const target = editor?.lesson
    const fields = {
      name: draft.name,
      room: draft.room || undefined,
      day: draft.day,
      start: draft.start,
      end: draft.end,
    }
    if (target) {
      await db.lessons.update(target.id, fields)
    } else {
      await db.lessons.add({ id: newId(), createdAt: Date.now(), ...fields })
    }
    setEditor(null)
  }

  async function deleteLesson() {
    const target = editor?.lesson
    if (!target) return
    await db.lessons.delete(target.id)
    setEditor(null)
  }

  return (
    <>
      <ScreenHeader
        title="Timetable"
        action={
          <button
            type="button"
            onClick={() => setEditor({ lesson: null, day: 0, start: minutesToTime(DAY_START) })}
            className="rounded-md border border-line px-2.5 py-1 text-sm text-muted hover:border-muted"
          >
            + lesson
          </button>
        }
      />

      <TimetableGrid
        lessons={lessons ?? []}
        onTapLesson={(l) => setEditor({ lesson: l, day: l.day, start: l.start })}
        onTapSlot={(day, startMinutes) =>
          setEditor({ lesson: null, day, start: minutesToTime(startMinutes) })
        }
      />

      <p className="px-4 pb-8 pt-1 text-center text-[11px] text-dim">
        {lessons && lessons.length === 0
          ? 'Tap any slot to add a lesson.'
          : 'Tap a lesson to edit it, or an empty slot to add one.'}
      </p>

      {editor && (
        <LessonEditor
          lesson={editor.lesson}
          defaults={{ day: editor.day, start: editor.start }}
          onSave={(d) => void saveLesson(d)}
          onDelete={() => void deleteLesson()}
          onClose={() => setEditor(null)}
        />
      )}
    </>
  )
}
