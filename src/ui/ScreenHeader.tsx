import type { ReactNode } from 'react'

export function ScreenHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <header className="flex items-baseline justify-between px-4 pb-3 pt-4">
      <h1 className="font-display text-2xl font-medium">{title}</h1>
      {action}
    </header>
  )
}
