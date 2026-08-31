import { ScreenHeader } from '@/ui/ScreenHeader'
import { EmptyState } from '@/ui/EmptyState'

export function CalendarScreen() {
  return (
    <>
      <ScreenHeader title="Kalendář" />
      <EmptyState title="Kalendář zatím není hotový." hint="Na řadě po úkolech." />
    </>
  )
}
