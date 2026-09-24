import { useEffect, useState } from 'react'
import { BottomNav, type Screen } from './app/BottomNav'
import {
  backfillEmojis,
  backfillLessonExceptions,
  backfillSubjectHost,
  seedIfEmpty,
  seedTimetableIfEmpty,
  seedTodoFoldersIfEmpty,
} from './db/seed'
import { RoutineTrackerScreen } from './features/routines/RoutineTrackerScreen'
import { TodosScreen } from './features/todos/TodosScreen'
import { CalendarScreen } from './features/calendar/CalendarScreen'
import { TimetableScreen } from './features/timetable/TimetableScreen'
import { SettingsScreen } from './features/settings/SettingsScreen'
import { SyncProvider } from './sync/SyncProvider'

export default function App() {
  const [screen, setScreen] = useState<Screen>('routines')

  useEffect(() => {
    void seedIfEmpty().then(backfillEmojis)
    void seedTimetableIfEmpty().then(backfillLessonExceptions)
    void seedTodoFoldersIfEmpty().then(backfillSubjectHost)
  }, [])

  // The provider sits above the screen switch on purpose: sync runs for as long
  // as the app is open, whichever tab that is. See `sync/SyncProvider.tsx`.
  return (
    <SyncProvider>
      {(sync) => (
        <div className="mx-auto flex h-full max-w-2xl flex-col">
          <main className="min-h-0 flex-1 overflow-y-auto">
            {screen === 'routines' && <RoutineTrackerScreen />}
            {screen === 'todos' && <TodosScreen />}
            {screen === 'calendar' && <CalendarScreen />}
            {screen === 'timetable' && <TimetableScreen />}
            {screen === 'settings' && <SettingsScreen />}
          </main>
          <BottomNav active={screen} onChange={setScreen} alert={sync.needsAttention} />
        </div>
      )}
    </SyncProvider>
  )
}
