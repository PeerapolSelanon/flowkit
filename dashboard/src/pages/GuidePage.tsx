import { useState, useEffect } from 'react'
import { ExternalLink, LifeBuoy, Puzzle } from 'lucide-react'
import { fetchAPI } from '../api/client'
import { useTranslation } from '../i18n/useTranslation'
import type { TranslationKey } from '../i18n/translations'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../components/ui/accordion'
import { Button } from '../components/ui/button'
import Panel from '../components/common/Panel'
import { Dot, Pill } from '../components/common/status'

interface HealthResponse {
  status: string
  version: string
  extension_connected: boolean
  ws: { connected: boolean; active_connections: number; authenticated_connections: number; connects: number; disconnects: number; uptime_s: number | null }
}

function useHealthPoll() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [reachable, setReachable] = useState(true)
  useEffect(() => {
    let cancelled = false
    const poll = () => fetchAPI<HealthResponse>('/health')
      .then(h => { if (!cancelled) { setHealth(h); setReachable(true) } })
      .catch(() => { if (!cancelled) { setHealth(null); setReachable(false) } })
    Promise.resolve().then(poll)
    const id = setInterval(poll, 4000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])
  return { health, reachable }
}

const STEP_KEYS: { titleKey: TranslationKey; bodyKey: TranslationKey }[] = [
  { titleKey: 'guide.step1.title', bodyKey: 'guide.step1.body' },
  { titleKey: 'guide.step2.title', bodyKey: 'guide.step2.body' },
  { titleKey: 'guide.step3.title', bodyKey: 'guide.step3.body' },
  { titleKey: 'guide.step4.title', bodyKey: 'guide.step4.body' },
]
const TROUBLE_KEYS: { problemKey: TranslationKey; solutionKey: TranslationKey }[] = [1, 2, 3, 4, 5, 6].map(i => ({ problemKey: `guide.trouble${i}.problem` as TranslationKey, solutionKey: `guide.trouble${i}.solution` as TranslationKey }))

/** Wrap anything that looks like a command, URL or path in <code>. */
function richText(text: string) {
  const parts = text.split(/(chrome:\/\/[\w/.-]+|https?:\/\/[^\s)]+|python -m agent\.main|curl [^\s]+|source [^\s]+|\.\/setup\.sh|extension\/|"[^"]+")/g)
  return parts.map((p, i) => (i % 2 === 1 ? <code key={i}>{p}</code> : p))
}

function uptime(s: number | null): string {
  if (s === null) return '—'
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function GuidePage() {
  const { t } = useTranslation()
  const { health, reachable } = useHealthPoll()

  return (
    <div className="fk-page fk-fade" style={{ maxWidth: 880 }}>
      <div>
        <h1 className="fk-title">{t('guide.title')}</h1>
        <p className="fk-lede">{t('guide.intro')}</p>
      </div>

      <Panel title={t('guide.status.title')} sub={t('guide.status.desc')} action={health && <Pill state="outline">v{health.version}</Pill>}>
        {!reachable ? (
          <div className="flex items-center gap-2 text-[13px] text-fail"><Dot state="down" />{richText(t('guide.status.unreachable'))}</div>
        ) : !health ? (
          <div className="text-[12px] text-fg-muted">{t('guide.status.checking')}</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="fk-inset px-3.5 py-3 flex flex-col gap-1">
              <span className="flex items-center gap-2 text-[13px]"><Dot state="ok" />{t('guide.status.agentRunning')}</span>
              <span className="text-[11px] text-fg-muted">{t('guide.status.uptime', { t: uptime(health.ws.uptime_s) })}</span>
            </div>
            <div className="fk-inset px-3.5 py-3 flex flex-col gap-1">
              <span className="flex items-center gap-2 text-[13px]" style={{ color: health.extension_connected ? 'var(--ok)' : 'var(--fail)' }}>
                <Dot state={health.extension_connected ? 'ok' : 'down'} />{health.extension_connected ? t('guide.status.extensionConnected') : t('guide.status.extensionDisconnected')}
              </span>
              <span className="text-[11px] text-fg-muted">{t('health.signal.extension')}</span>
            </div>
            <div className="fk-inset px-3.5 py-3 flex flex-col gap-1">
              <span className="flex items-center gap-2 text-[13px]"><Dot state={health.ws.authenticated_connections > 0 ? 'ok' : 'unknown'} />{t('guide.status.ws', { active: health.ws.active_connections, authenticated: health.ws.authenticated_connections })}</span>
              <span className="text-[11px] text-fg-muted">WebSocket</span>
            </div>
          </div>
        )}
      </Panel>

      <Panel title={t('guide.steps.title')} action={<Puzzle size={15} className="text-fg-muted" />}>
        <ol className="fk-steps m-0 p-0 list-none">
          {STEP_KEYS.map((s, i) => (
            <li key={s.titleKey} className="fk-step">
              <span className="fk-step-n">{i + 1}</span>
              <div>
                <h3>{t(s.titleKey)}</h3>
                <p>{richText(t(s.bodyKey))}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2 pt-4 mt-2 border-t border-line">
          <Button variant="outline" size="sm" asChild><a href="https://flow.google.com/" target="_blank" rel="noreferrer"><ExternalLink /> {t('health.openFlow')}</a></Button>
        </div>
      </Panel>

      <Panel title={t('guide.trouble.title')} action={<LifeBuoy size={15} className="text-fg-muted" />}>
        <Accordion type="multiple">
          {TROUBLE_KEYS.map(tr => (
            <AccordionItem key={tr.problemKey} value={tr.problemKey}>
              <AccordionTrigger><span className="text-[13px] font-medium text-left">{t(tr.problemKey)}</span></AccordionTrigger>
              <AccordionContent><p className="m-0 text-[12.5px] text-fg-2 leading-relaxed">{richText(t(tr.solutionKey))}</p></AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Panel>
    </div>
  )
}
