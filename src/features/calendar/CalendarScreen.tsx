import { ScreenHeader } from '@/ui/ScreenHeader'
import { EmptyState } from '@/ui/EmptyState'

export function CalendarScreen() {
  return (
    <>
      <ScreenHeader title="Calendar" />
      <EmptyState title="The calendar isn't built yet." hint="Next up after todos." />
    </>
  )
}
