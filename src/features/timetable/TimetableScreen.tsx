import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, stamp, type Lesson } from '@/db/db'
import { removeRecord } from '@/db/remove'
import { cn } from '@/lib/cn'
import { toISODate, weekParity, type WeekdayIndex } from '@/lib/date'
import { minutesToTime } from '@/lib/time'
import { ScreenHeader } from '@/ui/ScreenHeader'
import { TimetableGrid } from './TimetableGrid'
import { LessonEditor, type LessonDraft } from './LessonEditor'
import { formatShort } from '@/lib/date'
import { DAY_START, KINDS, KIND_LABELS, KIND_NAMES, KIND_STYLES } from './layout'
import { SemesterNav } from './SemesterNav'
import { toggledOccurrence } from './occurrence'
import { toggledAbsence } from './absence'
import { coverOn, coverPatch } from './cover'
import { semesterEnd, semesterStart, semesterWeekCount } from './semester'
import { useSemesterWeek } from './useSemesterWeek'

interface EditorTarget {
  /** null = creating a new lesson in the `day` / `start` slot */
  lesson: Lesson | null
  day: WeekdayIndex
  start: string
  /** which dated occurrence was tapped, so it can be cancelled on its own */
  date: string | null
}

export function TimetableScreen() {
  const [editor, setEditor] = useState<EditorTarget | null>(null)
  const week = useSemesterWeek()
  const lessons = useLiveQuery(() => db.lessons.toArray(), [])

  async function saveLesson(draft: LessonDraft) {
    const target = editor?.lesson
    const fields = {
      name: draft.name,
      kind: draft.kind,
      group: draft.group || undefined,
      room: draft.room || undefined,
      day: draft.day,
      start: draft.start,
      end: draft.end,
      weeks: draft.weeks ?? undefined,
      recorded: draft.recorded || undefined,
      absenceLimit: draft.absenceLimit || undefined,
    }
    if (target) {
      await db.lessons.update(target.id, fields)
    } else {
      await db.lessons.add({ id: newId(), ...stamp(), ...fields })
    }
    setEditor(null)
  }

  /** Cancel or restore the one date that was tapped, not the weekly lesson. */
  async function toggleOccurrence() {
    const target = editor?.lesson
    const date = editor?.date
    if (!target || !date) return
    await db.lessons.update(target.id, toggledOccurrence(target, date))
    setEditor(null)
  }

  /** Record (or take back) an absence on the tapped date, like cancelling one. */
  async function toggleAbsence() {
    const target = editor?.lesson
    const date = editor?.date
    if (!target || !date) return
    await db.lessons.update(target.id, toggledAbsence(target, date))
    setEditor(null)
  }

  /**
   * Mark (or unmark) the tapped date covered — the same flag Today's checkbox
   * sets. Reachable here too so a date that's already dropped off Today (or
   * was ticked by mistake) can still be reopened.
   */
  async function toggleCover() {
    const target = editor?.lesson
    const date = editor?.date
    if (!target || !date) return
    await db.lessons.update(target.id, coverPatch(target, date, !coverOn(target, date)))
    setEditor(null)
  }

  async function deleteLesson() {
    const target = editor?.lesson
    if (!target) return
    await removeRecord('lessons', target.id)
    setEditor(null)
  }

  return (
    <>
      <ScreenHeader
        title="Timetable"
        action={
          <button
            type="button"
            onClick={() =>
              setEditor({ lesson: null, day: 0, start: minutesToTime(DAY_START), date: null })
            }
            className="rounded-md border border-line px-2.5 py-1 text-sm text-muted hover:border-muted"
          >
            + lesson
          </button>
        }
      />

      <SemesterNav week={week} />

      {/*
        A week other than the one we're in is reference, not the day's plan, so
        the whole grid steps back: dimmed and drained of most of its colour. It
        stays fully interactive — paging back to cancel a lesson or record an
        absence is the main reason to be there at all — and the wash is applied
        here rather than inside the grid so nothing has to thread "is this the
        current week" through every block, tick and marker. Outside the semester
        no week is current, so all of them read this way, which is right: none
        of them is today.
      */}
      <div
        className={cn(
          'transition-[opacity,filter] duration-150',
          week.isCurrent ? '' : 'opacity-70 saturate-[.45]',
        )}
      >
        <TimetableGrid
          lessons={lessons ?? []}
          dates={week.dates}
          parity={weekParity(week.week)}
          showNow={week.isCurrent}
          onTapLesson={(l) =>
            setEditor({
              lesson: l,
              day: l.day,
              start: l.start,
              date: toISODate(week.dates[l.day]),
            })
          }
          onTapSlot={(day, startMinutes) =>
            setEditor({
              lesson: null,
              day,
              start: minutesToTime(startMinutes),
              date: toISODate(week.dates[day]),
            })
          }
        />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pt-2 text-[11px] text-muted">
        {KINDS.map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={`inline-block h-3.5 w-3.5 rounded border-[1.5px] ${KIND_STYLES[k]}`} />
            {KIND_LABELS[k]} · {KIND_NAMES[k]}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="flex gap-[2px]">
            <span className="h-[5px] w-[5px] rounded-full border border-missed bg-missed" />
            <span className="h-[5px] w-[5px] rounded-full border border-muted" />
          </span>
          absences used / left
        </span>
      </div>

      <p className="px-4 pb-8 pt-1 text-center text-[11px] text-dim">
        {lessons && lessons.length === 0
          ? 'Tap any slot to add a lesson.'
          : 'Tap a lesson to edit it, or an empty slot to add one.'}
        {' · '}
        Semester {formatShort(semesterStart())} – {formatShort(semesterEnd())},{' '}
        {semesterWeekCount()} weeks
      </p>

      {editor && (
        <LessonEditor
          lesson={editor.lesson}
          defaults={{ day: editor.day, start: editor.start }}
          occurrenceDate={editor.date}
          occurrenceParity={weekParity(week.week)}
          onSave={(d) => void saveLesson(d)}
          onToggleAbsence={() => void toggleAbsence()}
          onToggleOccurrence={() => void toggleOccurrence()}
          onToggleCover={() => void toggleCover()}
          onDelete={() => void deleteLesson()}
          onClose={() => setEditor(null)}
        />
      )}
    </>
  )
}
