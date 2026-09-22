import { useState, useEffect, useCallback, useMemo } from 'react'
import { Pause, Play, Search, ScrollText } from 'lucide-react'
import { fetchAPI } from '../../api/client'
import { useReloadOnEvent } from '../../api/useReloadOnEvent'
import { useTranslation } from '../../i18n/useTranslation'
import { statusLabel } from '../../i18n/labels'
import type { Request, Character, StatusType } from '../../types'
import { Skeleton } from '../ui/skeleton'
import { Button } from '../ui/button'
import EmptyState from '../common/EmptyState'
import { Dot, Pill } from '../common/status'

interface LogRow { id: string; time: string; type: string; status: StatusType; severity: 'info' | 'error'; target: string; detail: string }

export default function LogViewer() {
  const { t, lang } = useTranslation()
  const [requests, setRequests] = useState<Request[] | null>(null)
  const [characters, setCharacters] = useState<Character[]>([])
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [sevFilter, setSevFilter] = useState<'all' | 'info' | 'error'>('all')
  const [paused, setPaused] = useState(false)

  const load = useCallback(async () => {
    const [reqs, chars] = await Promise.all([fetchAPI<Request[]>('/api/requests'), fetchAPI<Character[]>('/api/characters')])
    setRequests(reqs); setCharacters(chars)
  }, [])

  useEffect(() => { Promise.resolve().then(load) }, [load])
  useReloadOnEvent(load, { enabled: !paused })

  const rows = useMemo<LogRow[]>(() => {
    const charIndex = new Map(characters.map(c => [c.id, c.name]))
    return (requests ?? []).slice().sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? '')).map(r => ({
      id: r.id,
      time: r.updated_at,
      type: r.type,
      status: r.status,
      severity: r.status === 'FAILED' ? 'error' : 'info',
      target: r.character_id ? (charIndex.get(r.character_id) ?? r.character_id.slice(0, 8)) : r.scene_id ? t('logs.targetScene', { id: r.scene_id.slice(0, 8) }) : r.id.slice(0, 8),
      detail: r.error_message ?? (r.retry_count ? t('logs.detailRetry', { n: r.retry_count }) : ''),
    }))
  }, [requests, characters, t])

  const types = useMemo(() => Array.from(new Set(rows.map(r => r.type))).sort(), [rows])
  const q = query.trim().toLowerCase()
  const filtered = rows.filter(row =>
    (typeFilter === 'all' || row.type === typeFilter) &&
    (sevFilter === 'all' || row.severity === sevFilter) &&
    (!q || `${row.type} ${row.target} ${row.status} ${row.detail}`.toLowerCase().includes(q)))

  const errCount = rows.filter(r => r.severity === 'error').length

  return (
    <div className="fk-page fk-fade" style={{ minHeight: 'calc(100dvh - 120px)' }}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="fk-title">{t('logs.title')}</h1>
          <p className="fk-lede">{t('logs.lede')}</p>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-fg-muted">
          <Dot state={paused ? 'unknown' : 'ok'} />
          <span>{paused ? t('logs.tailPaused') : t('logs.live')}</span>
          <span>· {t('logs.footerCount', { n: filtered.length, m: rows.length })}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <label className="fk-search w-full sm:w-80">
          <Search />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('logs.searchPlaceholder')} className="fk-input" />
        </label>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="fk-select w-auto">
          <option value="all">{t('logs.allTypes')}</option>
          {types.map(rt => <option key={rt} value={rt}>{rt}</option>)}
        </select>
        <div className="fk-seg">
          {(['all', 'info', 'error'] as const).map(s => (
            <button key={s} aria-pressed={sevFilter === s} onClick={() => setSevFilter(s)}>
              {s === 'all' ? t('logs.sev.any') : s === 'info' ? t('logs.sev.info') : t('logs.sev.error')}
              {s === 'error' && errCount > 0 && <span className="ml-1.5 text-fail tabular-nums">{errCount}</span>}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" className="sm:ml-auto" onClick={() => setPaused(p => !p)}>
          {paused ? <Play /> : <Pause />} {paused ? t('logs.resume') : t('logs.pause')}
        </Button>
      </div>

      <section className="fk-panel overflow-hidden flex-1 min-h-0 flex flex-col">
        {requests === null ? (
          <div className="p-4 flex flex-col gap-2">{[0, 1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-9 rounded-md" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={ScrollText} title={t('logs.empty')} />
        ) : (
          <div className="fk-table-wrap overflow-y-auto" style={{ maxHeight: 'calc(100dvh - 300px)' }}>
            <table className="fk-table" style={{ minWidth: 720 }}>
              <thead>
                <tr>
                  <th style={{ width: 170 }}>{t('logs.table.time')}</th>
                  <th style={{ width: 210 }}>{t('logs.table.type')}</th>
                  <th style={{ width: 130 }}>{t('logs.table.status')}</th>
                  <th style={{ width: 170 }}>{t('logs.table.target')}</th>
                  <th>{t('logs.table.detail')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => (
                  <tr key={row.id} style={row.severity === 'error' ? { background: 'rgba(255,107,107,.035)' } : undefined}>
                    <td className="mono whitespace-nowrap">{new Date(row.time).toLocaleString(lang, { dateStyle: 'short', timeStyle: 'medium' })}</td>
                    <td className="font-mono text-[11px]" style={{ color: row.severity === 'error' ? 'var(--fail)' : 'var(--accent)' }}>{row.type}</td>
                    <td><Pill state={row.status} dot>{statusLabel(t, row.status)}</Pill></td>
                    <td className="text-fg-2">{row.target}</td>
                    <td className="text-fg-2" style={{ overflowWrap: 'anywhere' }}>{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
