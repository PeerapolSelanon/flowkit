import { useTranslation } from '../i18n/useTranslation'
import type { TranslationKey } from '../i18n/translations'
import { useSystemHealth, type SignalKey } from '../api/systemHealth'
import { Dot } from './common/status'

const SIGNALS: SignalKey[] = ['agent', 'extension', 'flow', 'worker']

export default function HealthStrip() {
  const { t } = useTranslation()
  const h = useSystemHealth()
  const top = h.problems[0]

  const detail = (k: SignalKey): string => {
    if (k === 'worker' && h[k] === 'ok' && h.tickAge !== null) return t('health.tickAge', { s: h.tickAge })
    if (k === 'worker' && h[k] === 'down' && h.stuckMinutes > 0) return t('health.stuckJob', { m: h.stuckMinutes })
    return t(`health.state.${h[k]}` as TranslationKey)
  }

  return (
    <section className="fk-health" data-state={top ? 'alarm' : 'ok'} aria-live="polite">
      <Dot state={top ? 'down' : 'ok'} className="is-hero" />
      <h2 className="fk-health-title">{top ? t(`health.problem.${top}` as TranslationKey) : t('health.ok')}</h2>
      {top && (
        <p className="fk-health-fix">
          {t(`health.fix.${top}` as TranslationKey, { s: h.tickAge ?? 0, m: h.stuckMinutes })}
          {(top === 'extension' || top === 'flow') && <> <a href="https://flow.google.com/" target="_blank" rel="noreferrer">{t('health.openFlow')}</a></>}
          {top === 'agent' && <> <code>python -m agent.main</code></>}
        </p>
      )}
      <ul className="fk-health-signals">
        {SIGNALS.map(k => (
          <li key={k} data-signal={h[k]}>
            <Dot state={h[k]} />
            <span className="name">{t(`health.signal.${k}` as TranslationKey)}</span>
            <span className="detail">{detail(k)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
