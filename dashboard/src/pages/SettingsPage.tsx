import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Save, TerminalSquare, Bot } from 'lucide-react'
import { fetchAPI, patchAPI } from '../api/client'
import { useTranslation } from '../i18n/useTranslation'
import type { RoleAssignment, ProvidersResponse, ProviderModelsResponse, ProvidersUpdateResponse } from '../types'
import { Button } from '../components/ui/button'
import { Skeleton } from '../components/ui/skeleton'
import Panel from '../components/common/Panel'
import EmptyState from '../components/common/EmptyState'
import { Dot, Pill } from '../components/common/status'

const DEFAULT_OPTION = '__default__'
const CUSTOM_OPTION = '__custom__'

interface SaveState { ok: boolean; text: string }

// fetchAPI throws `API <status>: <body>` — pull the backend's `detail` back out so a 400 reads verbatim.
function apiDetail(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  const body = raw.replace(/^API \d+: /, '')
  try {
    const parsed = JSON.parse(body) as { detail?: unknown }
    if (typeof parsed.detail === 'string') return parsed.detail
  } catch { /* not JSON */ }
  return raw
}

const cloneRoles = (roles: Record<string, RoleAssignment>) => Object.fromEntries(Object.entries(roles).map(([id, r]) => [id, { ...r }]))
const sameAssignment = (a: RoleAssignment, b: RoleAssignment) => a.provider === b.provider && a.model === b.model && a.effort === b.effort

export default function SettingsPage() {
  const { t } = useTranslation()
  const [data, setData] = useState<ProvidersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, RoleAssignment>>({})
  const [models, setModels] = useState<Record<string, ProviderModelsResponse>>({})
  const [modelsLoading, setModelsLoading] = useState<Record<string, boolean>>({})
  const [customModel, setCustomModel] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({})
  const [testing, setTesting] = useState(false)
  const [testError, setTestError] = useState<string | null>(null)

  const loadModels = useCallback(async (provider: string, refresh: boolean) => {
    setModelsLoading(prev => ({ ...prev, [provider]: true }))
    try {
      const res = await fetchAPI<ProviderModelsResponse>(`/api/providers/models?provider=${encodeURIComponent(provider)}&refresh=${refresh}`)
      setModels(prev => ({ ...prev, [provider]: res }))
    } catch {
      setModels(prev => ({ ...prev, [provider]: { provider, models: [], authoritative: false } }))
    } finally {
      setModelsLoading(prev => ({ ...prev, [provider]: false }))
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setLoadError(null)
    try {
      const res = await fetchAPI<ProvidersResponse>('/api/providers?live=false')
      setData(res); setDrafts(cloneRoles(res.roles)); setCustomModel({}); setSaveState({})
      Array.from(new Set(Object.values(res.roles).map(r => r.provider))).forEach(p => { loadModels(p, false) })
    } catch (err) {
      setData(null); setLoadError(apiDetail(err))
    } finally { setLoading(false) }
  }, [loadModels])

  useEffect(() => { Promise.resolve().then(load) }, [load])

  function updateDraft(roleId: string, patch: Partial<RoleAssignment>) {
    setDrafts(prev => ({ ...prev, [roleId]: { ...prev[roleId], ...patch } }))
    setSaveState(prev => { if (!(roleId in prev)) return prev; const n = { ...prev }; delete n[roleId]; return n })
  }
  function changeProvider(roleId: string, provider: string) {
    const efforts = data?.providers[provider]?.efforts ?? []
    const current = drafts[roleId]
    const effort = current.effort !== null && efforts.includes(current.effort) ? current.effort : null
    updateDraft(roleId, { provider, model: null, effort })
    setCustomModel(prev => ({ ...prev, [roleId]: false }))
    if (!models[provider] && !modelsLoading[provider]) loadModels(provider, false)
  }
  function setModel(roleId: string, model: string | null) {
    const encodesEffort = data?.providers[drafts[roleId].provider]?.model_encodes_effort ?? false
    updateDraft(roleId, model !== null && encodesEffort ? { model, effort: null } : { model })
  }
  function selectModel(roleId: string, value: string) {
    if (value === CUSTOM_OPTION) { setCustomModel(prev => ({ ...prev, [roleId]: true })); setModel(roleId, null); return }
    setModel(roleId, value === DEFAULT_OPTION ? null : value)
  }
  async function save(roleId: string) {
    const draft = drafts[roleId]
    const model = draft.model !== null && draft.model.trim() !== '' ? draft.model.trim() : null
    const encodesEffort = data?.providers[draft.provider]?.model_encodes_effort ?? false
    const effort = model !== null && encodesEffort ? null : draft.effort
    setSaving(prev => ({ ...prev, [roleId]: true }))
    try {
      const res = await patchAPI<ProvidersUpdateResponse>('/api/providers', { roles: { [roleId]: { provider: draft.provider, model, effort } } })
      setData(prev => (prev ? { ...prev, active: res.active, roles: res.roles } : prev))
      setDrafts(prev => ({ ...prev, [roleId]: { ...(res.roles[roleId] ?? prev[roleId]) } }))
      setSaveState(prev => ({ ...prev, [roleId]: { ok: true, text: t('settings.saved') } }))
    } catch (err) {
      setSaveState(prev => ({ ...prev, [roleId]: { ok: false, text: apiDetail(err) } }))
    } finally { setSaving(prev => ({ ...prev, [roleId]: false })) }
  }
  async function runTest() {
    setTesting(true); setTestError(null)
    try {
      const res = await fetchAPI<ProvidersResponse>('/api/providers?live=true')
      setData(prev => (prev ? { ...prev, providers: res.providers } : res))
    } catch (err) { setTestError(apiDetail(err)) } finally { setTesting(false) }
  }

  if (loading) {
    return <div className="fk-page"><Skeleton className="h-10 w-72 rounded-lg" /><Skeleton className="h-[160px] rounded-[14px]" /><Skeleton className="h-[220px] rounded-[14px]" /></div>
  }
  if (!data) {
    return (
      <div className="fk-page">
        <div className="fk-panel"><EmptyState icon={Bot} title={loadError ?? t('settings.loadFailed')} action={<Button variant="outline" size="sm" onClick={() => { Promise.resolve().then(load) }}>{t('settings.retry')}</Button>} /></div>
      </div>
    )
  }

  const providers = data.providers
  const roleIds = Object.keys(data.roles)

  return (
    <div className="fk-page fk-fade" style={{ maxWidth: 1080 }}>
      <div>
        <h1 className="fk-title">{t('settings.title')}</h1>
        <p className="fk-lede">{t('settings.desc')}</p>
      </div>

      <Panel
        title={t('settings.providers.title')}
        sub={t('settings.testHint')}
        action={<Button variant="outline" size="sm" disabled={testing} onClick={runTest}><TerminalSquare className={testing ? 'animate-pulse' : undefined} /> {testing ? t('settings.testing') : t('settings.test')}</Button>}
      >
        {testError && <pre className="fk-code is-error mb-3">{testError}</pre>}
        <div className="fk-table-wrap -mx-[18px] -mb-[18px]">
          <table className="fk-table" style={{ minWidth: 520 }}>
            <thead>
              <tr>
                <th>{t('settings.field.agent')}</th>
                <th>{t('settings.providers.installedHead')}</th>
                <th>{t('settings.providers.testHead')}</th>
                <th>{t('settings.providers.noteHead')}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(providers).map(([name, info]) => (
                <tr key={name}>
                  <td>
                    <span className="flex items-center gap-2 font-mono text-[12px]">
                      {info.binary}
                      {name === data.active && <Pill state="brand">{t('settings.activeProvider')}</Pill>}
                    </span>
                  </td>
                  <td><span className="flex items-center gap-2"><Dot state={info.installed ? 'ok' : 'down'} />{info.installed ? t('settings.providers.installed') : t('settings.providers.missing')}</span></td>
                  <td><span className="flex items-center gap-2"><Dot state={info.tested === null ? 'unknown' : info.tested ? 'ok' : 'down'} />{info.tested === null ? t('settings.providers.untested') : info.tested ? t('settings.providers.ok') : t('settings.providers.failed')}</span></td>
                  <td className="text-fg-muted text-[11px]" style={{ overflowWrap: 'anywhere' }}>{info.error ?? (info.default_model ?? '')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {roleIds.length === 0 ? (
        <div className="fk-panel"><EmptyState icon={Bot} title={t('settings.empty')} /></div>
      ) : roleIds.map(roleId => {
        const draft = drafts[roleId]
        const meta = data.role_meta[roleId]
        const info = providers[draft.provider]
        const efforts = info?.efforts ?? []
        const catalog = models[draft.provider]
        const modelList = catalog?.models ?? []
        const authoritative = catalog?.authoritative ?? false
        const modelBusy = modelsLoading[draft.provider] ?? false
        const custom = customModel[roleId] ?? false
        const knownModel = draft.model !== null && modelList.some(m => m.id === draft.model)
        const effortLocked = (info?.model_encodes_effort ?? false) && draft.model !== null
        const dirty = !sameAssignment(draft, data.roles[roleId])
        const busy = saving[roleId] ?? false
        const state = saveState[roleId]

        return (
          <Panel key={roleId} title={meta?.label ?? roleId} sub={meta?.description ?? roleId} action={<Pill state={dirty ? 'busy' : 'ok'} dot>{dirty ? t('settings.unsaved') : t('settings.inSync')}</Pill>}>
            <div className="grid gap-4 items-start md:grid-cols-[1fr_1.6fr_1fr]">
              <div className="fk-field">
                <span className="fk-label">{t('settings.field.agent')}</span>
                <select value={draft.provider} onChange={e => changeProvider(roleId, e.target.value)} className="fk-select">
                  {Object.entries(providers).map(([name, p]) => (
                    <option key={name} value={name} disabled={!p.installed}>{p.installed ? p.binary : `${p.binary} · ${t('settings.notInstalled')}`}</option>
                  ))}
                </select>
                {info && !info.installed && <span className="text-[11px] text-fail leading-snug">{t('settings.installHint', { binary: info.binary })}</span>}
              </div>

              <div className="fk-field">
                <span className="fk-label">{t('settings.field.model')}</span>
                <div className="flex items-center gap-1.5">
                  {custom ? (
                    <input value={draft.model ?? ''} onChange={e => setModel(roleId, e.target.value === '' ? null : e.target.value)} placeholder={t('settings.modelCustomPlaceholder')} className="fk-input font-mono" />
                  ) : (
                    <select value={draft.model ?? DEFAULT_OPTION} onChange={e => selectModel(roleId, e.target.value)} className="fk-select">
                      <option value={DEFAULT_OPTION}>{t('settings.optionDefault')}</option>
                      {modelList.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                      {draft.model !== null && !knownModel && <option value={draft.model}>{draft.model}</option>}
                      {!authoritative && <option value={CUSTOM_OPTION}>{t('settings.optionCustom')}</option>}
                    </select>
                  )}
                  <Button variant="outline" size="icon-sm" aria-label={t('settings.refreshModels')} title={t('settings.refreshModels')} disabled={modelBusy} onClick={() => { loadModels(draft.provider, true) }}>
                    <RefreshCw className={modelBusy ? 'animate-spin' : undefined} />
                  </Button>
                </div>
                <span className="text-[11px] text-fg-muted leading-snug">
                  {modelBusy ? t('settings.modelsLoading') : modelList.length === 0 ? t('settings.modelsEmpty') : !authoritative ? t('settings.modelsFreeText') : ''}
                </span>
                {custom && (
                  <button type="button" className="text-[11px] text-left text-brand bg-transparent border-0 p-0 font-[inherit] hover:underline underline-offset-4" onClick={() => { setCustomModel(prev => ({ ...prev, [roleId]: false })); setModel(roleId, null) }}>
                    {t('settings.modelBackToList')}
                  </button>
                )}
              </div>

              <div className="fk-field">
                <span className="fk-label">{t('settings.field.effort')}</span>
                <select value={effortLocked ? DEFAULT_OPTION : draft.effort ?? DEFAULT_OPTION} disabled={effortLocked} onChange={e => updateDraft(roleId, { effort: e.target.value === DEFAULT_OPTION ? null : e.target.value })} className="fk-select">
                  <option value={DEFAULT_OPTION}>{t('settings.optionDefault')}</option>
                  {efforts.map(x => <option key={x} value={x}>{x}</option>)}
                </select>
                {effortLocked && <span className="text-[11px] text-fg-muted leading-snug">{t('settings.effortLockedHint', { binary: info.binary })}</span>}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-4 mt-4 border-t border-line">
              <Button size="sm" disabled={!dirty || busy} onClick={() => save(roleId)}><Save /> {busy ? t('settings.saving') : t('settings.save')}</Button>
              {state && <span className="text-[12px]" style={{ color: state.ok ? 'var(--ok)' : 'var(--fail)' }}>{state.text}</span>}
            </div>
          </Panel>
        )
      })}
    </div>
  )
}
