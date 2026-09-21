import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { fetchAPI } from './client'
import { useWebSocketContext } from './useWebSocketContext'
import { useTranslation } from '../i18n/useTranslation'
import type { Request } from '../types'
import {
  SystemHealthContext, TICK_STALE_S, JOB_STUCK_MIN, FLOW_BLOCK_WINDOW_MIN, FLOW_BLOCK_RE,
  type Signal, type SignalKey, type SystemHealth,
} from './systemHealth'

const ALARM_FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Ccircle cx='8' cy='8' r='7' fill='%23ef4444'/%3E%3C/svg%3E"

function beep() {
  try {
    const ctx = new AudioContext()
    const play = (freq: number, at: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(0.18, at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.35)
      osc.start(at); osc.stop(at + 0.4)
    }
    play(880, ctx.currentTime)
    play(660, ctx.currentTime + 0.45)
  } catch {
    // no audio permission / autoplay blocked — the red page and tab title still carry the alarm
  }
}

export function SystemHealthProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { isConnected, events } = useWebSocketContext()
  const [agent, setAgent] = useState<Signal>('unknown')
  const [extension, setExtension] = useState<Signal>('unknown')
  const [requests, setRequests] = useState<Request[]>([])
  const [now, setNow] = useState(() => Date.now())

  // /health every 5s: agent reachable + extension connected
  useEffect(() => {
    let cancelled = false
    const poll = () => fetchAPI<{ extension_connected: boolean }>('/health')
      .then(h => { if (!cancelled) { setAgent('ok'); setExtension(h.extension_connected ? 'ok' : 'down') } })
      .catch(() => { if (!cancelled) { setAgent('down'); setExtension('unknown') } })
    poll()
    const id = setInterval(poll, 5000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  // /api/requests every 30s: stuck PROCESSING jobs + recent Flow blocks
  useEffect(() => {
    let cancelled = false
    const poll = () => fetchAPI<Request[]>('/api/requests').then(r => { if (!cancelled) setRequests(r) }).catch(() => {})
    poll()
    const id = setInterval(poll, 30000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(id)
  }, [])

  const lastTick = events.find(e => e.type === 'worker_tick')?.timestamp
  const tickAge = lastTick ? Math.max(0, Math.round((now - new Date(lastTick).getTime()) / 1000)) : null

  const health = useMemo<SystemHealth>(() => {
    const agentSignal: Signal = agent === 'down' || (agent === 'ok' && !isConnected) ? 'down' : agent
    const stuckMinutes = requests
      .filter(r => r.status === 'PROCESSING')
      .reduce((max, r) => Math.max(max, (now - new Date(r.updated_at).getTime()) / 60000), 0)
    const worker: Signal = agentSignal !== 'ok' ? 'unknown'
      : stuckMinutes >= JOB_STUCK_MIN || (tickAge !== null && tickAge > TICK_STALE_S) ? 'down'
      : tickAge === null ? 'unknown' : 'ok'
    const flowBlocked = requests.some(r =>
      r.status === 'FAILED' && FLOW_BLOCK_RE.test(r.error_message ?? '') &&
      now - new Date(r.updated_at).getTime() < FLOW_BLOCK_WINDOW_MIN * 60000)
    const flow: Signal = agentSignal !== 'ok' ? 'unknown' : flowBlocked ? 'down' : 'ok'
    const order: SignalKey[] = ['agent', 'extension', 'flow', 'worker']
    const signals = { agent: agentSignal, extension, flow, worker }
    return { ...signals, problems: order.filter(k => signals[k] === 'down'), tickAge, stuckMinutes: Math.floor(stuckMinutes) }
  }, [agent, extension, isConnected, requests, now, tickAge])

  // Page-level alarm: red tokens, tab title, favicon, one beep on the transition into alarm
  const top = health.problems[0]
  const wasAlarmed = useRef(false)
  useEffect(() => {
    const root = document.documentElement
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (top) {
      root.setAttribute('data-alarm', top)
      document.title = `🔴 ${t(`health.problem.${top}`)}`
      if (icon) icon.href = ALARM_FAVICON
      if (!wasAlarmed.current) beep()
    } else {
      root.removeAttribute('data-alarm')
      document.title = 'Flow Kit'
      if (icon) icon.href = '/favicon.svg'
    }
    wasAlarmed.current = Boolean(top)
  }, [top, t])

  return <SystemHealthContext.Provider value={health}>{children}</SystemHealthContext.Provider>
}
