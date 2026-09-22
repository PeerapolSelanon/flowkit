import type { ReactNode } from 'react'
import type { StatusType } from '../../types'

export type DotState = StatusType | 'ok' | 'busy' | 'down' | 'unknown'
export type PillState = DotState | 'RUNNING' | 'brand' | 'outline'

export function Dot({ state, className }: { state: DotState; className?: string }) {
  return <span className={`fk-dot ${className ?? ''}`} data-s={state} aria-hidden />
}

export function Pill({ state, dot, children, className }: { state: PillState; dot?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={`fk-pill ${className ?? ''}`} data-s={state}>
      {dot && <span className="fk-dot" data-s={state === 'RUNNING' ? 'busy' : state} />}
      {children}
    </span>
  )
}

/** Three-track bar: done / busy / failed segments, greyed remainder. */
export function Bar({ done, busy = 0, fail = 0, total, className }: { done: number; busy?: number; fail?: number; total: number; className?: string }) {
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0)
  const d = pct(done), b = pct(busy), f = pct(fail)
  return (
    <div className={`fk-bar ${className ?? ''}`} data-full={total > 0 && done === total} role="progressbar" aria-valuenow={d} aria-valuemin={0} aria-valuemax={100}>
      <i data-k="fail" style={{ width: `${d + b + f}%` }} />
      <i data-k="busy" style={{ width: `${d + b}%` }} />
      <i data-k="done" style={{ width: `${d}%` }} />
    </div>
  )
}
