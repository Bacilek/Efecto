import type { ReactNode } from 'react'
import type { Lesson, Todo } from '@/db/db'
import { cn } from '@/lib/cn'
import { DAY_LABELS } from '@/lib/date'
import { EmptyState } from '@/ui/EmptyState'
import { ClassRow } from './ClassRow'
import { weekDone, weeklyWeekday } from './weekly'
import { isUrgent, openCountOf, type SubjectFolder } from './subjectFolder'

/**
 * The subject tiles shown at the top of the folder flagged `showsSubjects` —
 * the same wrapping `auto-fill` grid as the folder overview, so they read as
 * sub-folders of it. They are derived from the timetable, not stored, so
 * there is nothing to reorder and no drag: dropping a subject from the
 * timetable simply removes its tile.
 */
export function SubjectTiles({
  folders,
  today,
  onOpen,
}: {
  folders: SubjectFolder[]
  today: string
  onOpen: (subject: string) => void
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3 px-4 pb-4">
      {folders.map((f) => {
        const open = openCountOf(f)
        return (
          <button
            key={f.subject}
            type="button"
            onClick={() => onOpen(f.subject)}
            className="flex aspect-square flex-col justify-between rounded-md border border-line p-3 text-left hover:border-muted"
          >
            <span className="flex items-center gap-1.5">
              <span
                className={cn(
                  'h-1.5 w-1.5 shrink-0 rounded-full',
                  isUrgent(f, today) ? 'bg-missed' : open > 0 ? 'bg-brass-dim' : 'bg-line',
                )}
              />
              <span className="min-w-0 truncate font-mono text-sm text-parchment">{f.subject}</span>
            </span>
            <span className="font-mono text-[11px] text-muted">
              {open === 0 ? 'all done' : `${open} open`}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * One subject, browsable: its classes to attend or watch, then every todo
 * tagged with it — including ones due later and ones already ticked, which is
 * what makes the view usable for editing the semester's weekly work rather
 * than only for clearing today's.
 */
export function SubjectFolderView({
  folder,
  today,
  onBack,
  onToggleCover,
  onEditTodo,
  children,
}: {
  folder: SubjectFolder
  today: string
  onBack: () => void
  onToggleCover: (lesson: Lesson, date: string, covered: boolean) => void
  onEditTodo: (todo: Todo) => void
  /** the todo rows, rendered by the screen so they keep their full gestures */
  children: (todos: Todo[]) => ReactNode
}) {
  const { subject, occurrences, weekly, weeklyTodos, todos } = folder

  return (
    <>
      <header className="flex items-center gap-1 px-2 pb-3 pt-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to the folder"
          className="h-9 w-9 shrink-0 rounded-md text-lg text-muted hover:text-parchment"
        >
          &larr;
        </button>
        <h1 className="min-w-0 flex-1 truncate font-display text-2xl font-medium">{subject}</h1>
      </header>

      {occurrences.length === 0 && weeklyTodos.length === 0 && todos.length === 0 ? (
        <EmptyState
          title="Nothing for this subject yet."
          hint={'Add a weekly task with "+" — it lands here already tagged.'}
        />
      ) : (
        <div className="pb-28">
          {occurrences.length > 0 && (
            <section className="px-4 pb-3">
              <h2 className="pb-1 text-[11px] uppercase tracking-wider text-muted">Classes</h2>
              <ul className="rounded-md border border-line-soft">
                {occurrences.map(({ lesson: l, date }) => (
                  <li key={`${l.id}|${date}`} className="border-b border-line-soft last:border-b-0">
                    <ClassRow
                      lesson={l}
                      date={date}
                      today={today}
                      onToggle={() =>
                        onToggleCover(l, date, !(l.coveredDates ?? []).includes(date))
                      }
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {weeklyTodos.length > 0 && (
            <section className="px-4 pb-3">
              <h2 className="pb-1 text-[11px] uppercase tracking-wider text-muted">Weekly</h2>
              <ul className="rounded-md border border-line-soft">
                {weeklyTodos.map((t) => {
                  const open = weekly.filter(
                    (o) => o.todo.id === t.id && !weekDone(o.todo, o.date),
                  ).length
                  return (
                    <li key={t.id} className="border-b border-line-soft last:border-b-0">
                      <button
                        type="button"
                        onClick={() => onEditTodo(t)}
                        className="flex w-full items-center gap-2 px-2 py-2 text-left text-sm"
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 shrink-0 rounded-full',
                            open > 0 ? 'bg-brass-dim' : 'bg-line',
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate text-parchment">{t.title}</span>
                        <span className="shrink-0 font-mono text-[11px] text-muted">
                          every {DAY_LABELS[weeklyWeekday(t)]}
                        </span>
                        <span className="shrink-0 font-mono text-[11px] text-muted">
                          {open === 0 ? 'all done' : `${open} open`}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {todos.length > 0 && (
            <section className="px-4">
              <h2 className="pb-1 text-[11px] uppercase tracking-wider text-muted">Tasks</h2>
              <ul>{children(todos)}</ul>
            </section>
          )}
        </div>
      )}
    </>
  )
}
