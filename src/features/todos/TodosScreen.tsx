import { ScreenHeader } from '@/ui/ScreenHeader'
import { EmptyState } from '@/ui/EmptyState'

export function TodosScreen() {
  return (
    <>
      <ScreenHeader title="Todos" />
      <EmptyState title="Todos aren't built yet." hint="They come right after routines." />
    </>
  )
}
