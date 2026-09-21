import { useEffect, useRef } from 'react'
import { useWebSocketContext } from './useWebSocketContext'

const RELOAD_EVENTS = new Set(['request_update', 'urls_refreshed'])

/** Call `load` (trailing-debounced) whenever the backend reports pipeline state changed.
 *  A burst of request_update events during a running pipeline becomes one reload. */
export function useReloadOnEvent(load: () => void | Promise<unknown>, { enabled = true, delayMs = 400 } = {}) {
  const { lastEvent } = useWebSocketContext()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!enabled || !lastEvent || !RELOAD_EVENTS.has(lastEvent.type)) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { timer.current = null; void load() }, delayMs)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [lastEvent, enabled, delayMs, load])
}
