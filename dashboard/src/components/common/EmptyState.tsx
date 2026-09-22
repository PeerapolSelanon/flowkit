import type { ReactNode } from 'react'
import { Clapperboard, type LucideIcon } from 'lucide-react'

export default function EmptyState({ icon: Icon = Clapperboard, title, hint, action }: { icon?: LucideIcon; title: ReactNode; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="fk-empty">
      <Icon strokeWidth={1.2} />
      <div className="flex flex-col gap-1">
        <b>{title}</b>
        {hint && <span>{hint}</span>}
      </div>
      {action}
    </div>
  )
}
