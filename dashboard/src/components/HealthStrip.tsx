import { useTranslation } from '../i18n/useTranslation'
import type { TranslationKey } from '../i18n/translations'
import { useSystemHealth, type SignalKey } from '../api/systemHealth'

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
    <section className="health" data-state={top ? 'alarm' : 'ok'} aria-live="polite">
      <div className="health-head">
        <span className={`health-dot ${top ? 'is-down' : 'is-ok'}`} />
        <h2 className="health-title">{top ? t(`health.problem.${top}` as TranslationKey) : t('health.ok')}</h2>
        {top && (
          <p className="health-fix">
            {t(`health.fix.${top}` as TranslationKey, { s: h.tickAge ?? 0, m: h.stuckMinutes })}
            {(top === 'extension' || top === 'flow') && (
              <> <a href="https://flow.google.com/" target="_blank" rel="noreferrer">{t('health.openFlow')}</a></>
            )}
            {top === 'agent' && <> <code>python -m agent.main</code></>}
          </p>
        )}
      </div>
      <ul className="health-signals">
        {SIGNALS.map(k => (
          <li key={k} data-signal={h[k]}>
            <span className={`health-dot ${h[k] === 'down' ? 'is-down' : h[k] === 'ok' ? 'is-ok' : 'is-unknown'}`} />
            <span className="health-name">{t(`health.signal.${k}` as TranslationKey)}</span>
            <span className="health-detail">{detail(k)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
