import { useEffect, useState } from 'react'
import { BottomNav, type Screen } from './app/BottomNav'
import { seedIfEmpty } from './db/seed'
import { RoutineTrackerScreen } from './features/routines/RoutineTrackerScreen'
import { TodosScreen } from './features/todos/TodosScreen'
import { CalendarScreen } from './features/calendar/CalendarScreen'
import { SettingsScreen } from './features/settings/SettingsScreen'

export default function App() {
  const [screen, setScreen] = useState<Screen>('routines')

  useEffect(() => {
    void seedIfEmpty()
  }, [])

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col">
      <main className="min-h-0 flex-1 overflow-y-auto">
        {screen === 'routines' && <RoutineTrackerScreen />}
        {screen === 'todos' && <TodosScreen />}
        {screen === 'calendar' && <CalendarScreen />}
        {screen === 'settings' && <SettingsScreen />}
      </main>
      <BottomNav active={screen} onChange={setScreen} />
    </div>
  )
}
