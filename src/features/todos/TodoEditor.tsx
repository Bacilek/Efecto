import { useEffect, useState, type ReactNode } from 'react'
import type { Todo, TodoFolder } from '@/db/db'
import { cn } from '@/lib/cn'
import { DAY_LABELS, formatShort, fromISODate, todayISO, type WeekdayIndex } from '@/lib/date'
import { nextOccurrenceISO } from './today'
import { weekdayOf, weeklyStartFor, withWeekday } from './weekly'

export interface TodoDraft {
  title: string
  note: string
  /** null = "Unsorted" */
  folderId: string | null
  /** `YYYY-MM-DD` it sits on the Today tab under; null = not planned */
  plannedFor: string | null
  /** `YYYY-MM-DD` deadline; null = no due date */
  dueBy: string | null
  /** subject code matching a `Lesson.name`; null = untagged */
  subject: string | null
  /** 0=Mon..6=Sun; null = not the deadline flavour */
  repeatWeekday: WeekdayIndex | null
  /** Monday of the first week owed; null = not the weekly-occurrence flavour */
  weeklySince: string | null
  /** spans the whole day on Calendar; mutually exclusive with the times below */
  allDay: boolean
  /** "HH:MM", set together with `endTime`; null = no timed block */
  startTime: string | null
  endTime: string | null
}

const ALL_DAYS: WeekdayIndex[] = [0, 1, 2, 3, 4, 5, 6]

export function TodoEditor({
  todo,
  folders,
  subjects,
  initialFolderId,
  initialPlannedFor,
  initialSubject,
  initialAllDay,
  initialStartTime,
  initialEndTime,
  onSave,
  onDelete,
  onClose,
}: {
  /** existing todo to edit, or null for a new one */
  todo: Todo | null
  folders: TodoFolder[]
  /** distinct subject codes the timetable knows about, for the Subject chips */
  subjects: string[]
  /** folder a new todo lands in — the one whose "+" was tapped */
  initialFolderId: string | null
  /** set for a todo added from the Today tab, so it lands there */
  initialPlannedFor: string | null
  /** set for a todo added from inside a subject folder, so it stays there */
  initialSubject?: string | null
  /** set for a todo added by tapping the Calendar's all-day strip */
  initialAllDay?: boolean
  /** set for a todo added by tapping an empty Calendar grid slot */
  initialStartTime?: string | null
  initialEndTime?: string | null
  onSave: (draft: TodoDraft) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [folderId, setFolderId] = useState<string | null>(null)
  const [plannedFor, setPlannedFor] = useState<string | null>(null)
  const [dueBy, setDueBy] = useState<string | null>(null)
  const [subject, setSubject] = useState<string | null>(null)
  // One choice, two payloads: `repeatWeekday` and `weeklySince` are written
  // from it in `submit()`, so the two flavours can never both be set and no
  // separate discriminator field is needed.
  const [repeat, setRepeat] = useState<RepeatMode>('none')
  const [repeatWeekday, setRepeatWeekday] = useState<WeekdayIndex | null>(null)
  const [weeklySince, setWeeklySince] = useState<string | null>(null)
  const [allDay, setAllDay] = useState(false)
  const [startTime, setStartTime] = useState<string | null>(null)
  const [endTime, setEndTime] = useState<string | null>(null)

  useEffect(() => {
    setTitle(todo?.title ?? '')
    setNote(todo?.note ?? '')
    setFolderId(todo ? (todo.folderId ?? null) : initialFolderId)
    setPlannedFor(todo ? (todo.plannedFor ?? null) : initialPlannedFor)
    setDueBy(todo?.dueBy ?? null)
    setSubject(todo ? (todo.subject ?? null) : (initialSubject ?? null))
    setRepeatWeekday(todo?.repeatWeekday ?? null)
    setWeeklySince(todo?.weeklySince ?? null)
    setRepeat(todo?.weeklySince ? 'week' : todo?.repeatWeekday !== undefined ? 'deadline' : 'none')
    setAllDay(todo ? !!todo.allDay : !!initialAllDay)
    setStartTime(todo ? (todo.startTime ?? null) : (initialStartTime ?? null))
    setEndTime(todo ? (todo.endTime ?? null) : (initialEndTime ?? null))
  }, [
    todo,
    initialFolderId,
    initialPlannedFor,
    initialSubject,
    initialAllDay,
    initialStartTime,
    initialEndTime,
  ])

  // With a catch-all folder around, "Unsorted" is only worth offering while
  // there are no folders at all, or to a todo that is already sitting there.
  // A subject-tagged todo's home is the subject, so a folder stops being
  // something it has to be given.
  const allowUnsorted = folders.length === 0 || !!(todo && !todo.folderId) || subject !== null

  // A recurring todo's deadline is computed, not picked — the next occurrence
  // of the chosen weekday, unless the weekday hasn't changed since this todo
  // already had one (rollover then owns it going forward).
  const computedDueBy =
    repeat === 'deadline' && repeatWeekday !== null
      ? todo?.repeatWeekday === repeatWeekday && todo.dueBy
        ? todo.dueBy
        : nextOccurrenceISO(repeatWeekday, todayISO())
      : null

  // The closing weekday lives in `weeklySince` itself — no second field to
  // fall out of step with it.
  const start = weeklyStartFor(0, todayISO())
  const weekEnds = weekdayOf(weeklySince ?? start)

  function submit() {
    const trimmed = title.trim()
    if (!trimmed) return
    onSave({
      title: trimmed,
      note: note.trim(),
      folderId,
      plannedFor,
      dueBy: repeat === 'deadline' ? computedDueBy : repeat === 'week' ? null : dueBy,
      subject,
      repeatWeekday: repeat === 'deadline' ? (repeatWeekday ?? 0) : null,
      weeklySince: repeat === 'week' ? (weeklySince ?? weeklyStartFor(0, todayISO())) : null,
      allDay,
      startTime: allDay ? null : startTime,
      endTime: allDay ? null : endTime,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div
        className="mx-auto w-full max-w-2xl rounded-t-2xl border-t border-line bg-panel p-4"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        <h2 className="mb-3 font-display text-lg">{todo ? 'Edit todo' : 'New todo'}</h2>

        <label className="mb-1 block text-xs text-muted">Task</label>
        <input
          autoFocus={!todo}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="e.g. Return the library books"
          className="mb-3 w-full rounded-md border border-line bg-panel-2 px-3 py-2 text-sm outline-none focus:border-muted"
        />

        <label className="mb-1 block text-xs text-muted">Note</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Optional"
          className="mb-3 w-full resize-none rounded-md border border-line bg-panel-2 px-3 py-2 text-sm outline-none focus:border-muted"
        />

        <label className="mb-1.5 block text-xs text-muted">Plan</label>
        <div className="mb-3 flex flex-wrap gap-1.5">
          <Chip active={plannedFor === null} onClick={() => setPlannedFor(null)}>
            Someday
          </Chip>
          <Chip active={plannedFor === todayISO()} onClick={() => setPlannedFor(todayISO())}>
            Today
          </Chip>
          <DateChip
            value={plannedFor}
            onChange={setPlannedFor}
            excludeToday
            ariaLabel="Plan for a date"
          />
        </div>

        {/* Only meaningful once a day is picked — an unplanned todo has nothing
            to be all-day or timed about. This is what the Calendar view reads:
            all-day (or nothing) puts it in the all-day strip, a time range
            places it as a block in the grid. */}
        {plannedFor !== null && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <Chip active={allDay} onClick={() => setAllDay(!allDay)}>
              All day
            </Chip>
            {!allDay && (
              <>
                <TimeChip
                  value={startTime}
                  onChange={setStartTime}
                  placeholder="Start"
                  ariaLabel="Start time"
                />
                <span className="text-xs text-dim">–</span>
                <TimeChip
                  value={endTime}
                  onChange={setEndTime}
                  placeholder="End"
                  ariaLabel="End time"
                />
              </>
            )}
          </div>
        )}

        {subjects.length > 0 && (
          <>
            <label className="mb-1.5 block text-xs text-muted">Subject</label>
            <div className="mb-3 flex flex-wrap gap-1.5">
              <Chip
                active={subject === null}
                onClick={() => {
                  setSubject(null)
                  // "Every week" is a school construct with no home outside a
                  // subject, so dropping the subject drops it too.
                  if (repeat === 'week') setRepeat('none')
                }}
              >
                None
              </Chip>
              {subjects.map((s) => (
                <Chip key={s} active={subject === s} onClick={() => setSubject(s)}>
                  {s}
                </Chip>
              ))}
            </div>
          </>
        )}

        <label className="mb-1.5 block text-xs text-muted">Repeats</label>
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          <Chip active={repeat === 'none'} onClick={() => setRepeat('none')}>
            One-off
          </Chip>
          {subject !== null && (
            <Chip
              active={repeat === 'week'}
              onClick={() => {
                setRepeat('week')
                setWeeklySince((prev) => prev ?? weeklyStartFor(0, todayISO()))
              }}
            >
              Every week
            </Chip>
          )}
          <Chip
            active={repeat === 'deadline'}
            onClick={() => {
              setRepeat('deadline')
              setRepeatWeekday((prev) => prev ?? 0)
            }}
          >
            By a weekday
          </Chip>
        </div>
        {repeat === 'week' && (
          <p className="mb-3 text-[11px] text-dim">
            No deadline — one per week, stacking until ticked and turning red a week on, exactly
            like a class.
          </p>
        )}
        {repeat === 'deadline' && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {ALL_DAYS.map((d) => (
              <Chip key={d} active={repeatWeekday === d} onClick={() => setRepeatWeekday(d)}>
                {DAY_LABELS[d]}
              </Chip>
            ))}
          </div>
        )}

        {/*
          "Every week" has no deadline at all — it is owed for a week, not by a
          date — so it gets its own labelled row. Sitting under a "Due" heading
          it read as a deadline picker, which is the one thing it is not.
        */}
        {repeat === 'week' ? (
          <>
            {/*
              The cycle closes on this weekday, which is not the same as a
              deadline: it is when the week is up. Picking it per task rather
              than deriving it from the timetable, because a subject can have
              several lessons a week and only the user knows which one the
              work is actually for.
            */}
            <label className="mb-1.5 block text-xs text-muted">Week ends on</label>
            <div className="mb-1.5 flex flex-wrap gap-1.5">
              {ALL_DAYS.map((d) => (
                <Chip
                  key={d}
                  active={weekEnds === d}
                  onClick={() => setWeeklySince((prev) => withWeekday(prev ?? start, d))}
                >
                  {DAY_LABELS[d]}
                </Chip>
              ))}
            </div>
            <div className="mb-4 flex flex-wrap gap-1.5">
              <DateChip
                value={weeklySince}
                onChange={(iso) => setWeeklySince(iso ? withWeekday(iso, weekEnds) : start)}
                icon="↻"
                label={`first ${formatShort(fromISODate(weeklySince ?? start))}`}
                ariaLabel="First cycle"
              />
            </div>
          </>
        ) : (
          <>
            <label className="mb-1.5 block text-xs text-muted">Due</label>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {repeat === 'deadline' ? (
                <span className="flex h-9 items-center rounded-md border border-line px-3 text-xs text-dim">
                  ⏰ next {formatShort(fromISODate(computedDueBy!))}
                </span>
              ) : (
                <>
                  <Chip active={dueBy === null} onClick={() => setDueBy(null)}>
                    No deadline
                  </Chip>
                  <DateChip
                    value={dueBy}
                    onChange={setDueBy}
                    icon="⏰"
                    label="Due date"
                    ariaLabel="Due date"
                  />
                </>
              )}
            </div>
          </>
        )}

        <label className="mb-1.5 block text-xs text-muted">Folder</label>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {allowUnsorted && (
            <Chip active={folderId === null} onClick={() => setFolderId(null)}>
              {subject !== null ? 'In the subject' : 'Unsorted'}
            </Chip>
          )}
          {folders.map((f) => (
            <Chip key={f.id} active={folderId === f.id} onClick={() => setFolderId(f.id)}>
              {f.emoji ? `${f.emoji} ${f.name}` : f.name}
            </Chip>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={!title.trim()}
            className="flex-1 rounded-md border border-brass-dim bg-brass-dim/30 py-2 text-sm text-parchment disabled:opacity-40"
          >
            Save
          </button>
          {todo && (
            <button
              type="button"
              onClick={() => {
                if (confirm(`Delete "${todo.title}"?`)) onDelete()
              }}
              className="rounded-md border border-missed-dim px-3 py-2 text-sm text-missed"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * The "on a date" pill: the same chip, with the platform's date picker behind
 * it (a transparent `<input type="date">`), so the sheet never has to draw a
 * calendar of its own. Active — and labelled with the date — once a date is
 * picked; `excludeToday` keeps it looking unpicked for today specifically,
 * for a row that already has its own dedicated "Today" chip alongside it.
 */
function DateChip({
  value,
  onChange,
  icon = '🗓︎',
  label = 'On a date',
  ariaLabel,
  excludeToday,
}: {
  value: string | null
  onChange: (iso: string | null) => void
  icon?: string
  label?: string
  ariaLabel: string
  excludeToday?: boolean
}) {
  const dated = value !== null && (!excludeToday || value !== todayISO())

  return (
    <label
      className={cn(
        'relative flex h-9 items-center rounded-md border px-3 text-xs transition-colors',
        dated ? 'border-brass-dim bg-brass-dim/30 text-parchment' : 'border-line text-dim',
      )}
    >
      {dated ? `${icon} ${formatShort(fromISODate(value))}` : `${icon} ${label}`}
      <input
        type="date"
        value={value ?? ''}
        aria-label={ariaLabel}
        onClick={(e) => {
          const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void }
          try {
            el.showPicker?.()
          } catch {
            /* refused without a gesture — the plain tap still opens it */
          }
        }}
        onChange={(e) => onChange(e.target.value || null)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </label>
  )
}

/**
 * A single "HH:MM" pill — the same native-input-behind-a-styled-label pattern
 * as `DateChip`, so no time widget is hand-drawn either.
 */
function TimeChip({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string | null
  onChange: (time: string | null) => void
  placeholder: string
  ariaLabel: string
}) {
  const set = value !== null

  return (
    <label
      className={cn(
        'relative flex h-9 items-center rounded-md border px-3 text-xs transition-colors',
        set ? 'border-brass-dim bg-brass-dim/30 text-parchment' : 'border-line text-dim',
      )}
    >
      {set ? value : placeholder}
      <input
        type="time"
        value={value ?? ''}
        aria-label={ariaLabel}
        onClick={(e) => {
          const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void }
          try {
            el.showPicker?.()
          } catch {
            /* refused without a gesture — the plain tap still opens it */
          }
        }}
        onChange={(e) => onChange(e.target.value || null)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </label>
  )
}

/** One option in a wrapping row of pickable pills. */
function Chip({
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
        'h-9 rounded-md border px-3 text-xs transition-colors',
        active ? 'border-brass-dim bg-brass-dim/30 text-parchment' : 'border-line text-dim',
      )}
    >
      {children}
    </button>
  )
}

/** Which recurrence a todo has, if any — see `TodoDraft`'s two payload fields. */
type RepeatMode = 'none' | 'deadline' | 'week'
