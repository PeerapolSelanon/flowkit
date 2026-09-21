import { createContext, useContext } from 'react'

export type Signal = 'ok' | 'down' | 'unknown'
export type SignalKey = 'agent' | 'extension' | 'flow' | 'worker'

export interface SystemHealth {
  agent: Signal
  extension: Signal
  worker: Signal
  flow: Signal
  /** Failing signals, most severe first. Empty means everything is connected. */
  problems: SignalKey[]
  /** Seconds since the last worker_tick, null until one is seen. */
  tickAge: number | null
  /** Minutes the oldest PROCESSING request has been sitting, 0 if none is stuck. */
  stuckMinutes: number
}

// ponytail: thresholds are single constants; make them settings if they ever need tuning per machine
export const TICK_STALE_S = 90
export const JOB_STUCK_MIN = 15
export const FLOW_BLOCK_WINDOW_MIN = 10
export const FLOW_BLOCK_RE = /CAPTCHA|UNUSUAL_ACTIVITY/i

export const SystemHealthContext = createContext<SystemHealth | null>(null)

export function useSystemHealth() {
  const ctx = useContext(SystemHealthContext)
  if (!ctx) throw new Error('useSystemHealth must be used within a SystemHealthProvider')
  return ctx
}
