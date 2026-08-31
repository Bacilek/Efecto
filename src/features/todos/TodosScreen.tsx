import { ScreenHeader } from '@/ui/ScreenHeader'
import { EmptyState } from '@/ui/EmptyState'

export function TodosScreen() {
  return (
    <>
      <ScreenHeader title="Úkoly" />
      <EmptyState title="Úkoly zatím nejsou hotové." hint="Přijdou hned po rutinách." />
    </>
  )
}
