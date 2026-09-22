import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, AlertTriangle, ArrowUpRight, CheckCircle2, Clapperboard, Inbox, Layers } from 'lucide-react'
import { fetchAPI } from '../api/client'
import { useWebSocketContext } from '../api/useWebSocketContext'
import { useReloadOnEvent } from '../api/useReloadOnEvent'
import { useTranslation } from '../i18n/useTranslation'
import type { TranslationKey } from '../i18n/translations'
import { stateLabel } from '../i18n/labels'
import type { Project, Video, Scene, Request, Character, WSEvent } from '../types'
import { sceneStageStatus, videoStageBreakdown } from '../lib/stageStats'
import { Skeleton } from '../components/ui/skeleton'
import HealthStrip from '../components/HealthStrip'
import Panel from '../components/common/Panel'
import EmptyState from '../components/common/EmptyState'
import Sparkline from '../components/common/Sparkline'
import FilmStrip from '../components/common/FilmStrip'
import { Pill } from '../components/common/status'

type VideoWithProject = Video & { projectName: string; projectId: string }
type T = (key: TranslationKey, params?: Record<string, string | number>) => string

const HOUR = 3600 * 1000

function describeEvent(t: T, e: WSEvent, requests: Request[]): { text: string; sev: 'ok' | 'error' | 'info' } {
  const data = (e.data ?? {}) as { id?: string; status?: string; type?: string; error?: string; count?: number }
  if (e.type === 'request_update') {
    const req = requests.find(r => r.id === data.id)
    const label = req?.type ?? data.type ?? t('dashboard.event.request')
    if (data.status === 'PROCESSING') return { text: t('dashboard.event.started', { label }), sev: 'info' }
    if (data.status === 'COMPLETED') return { text: t('dashboard.event.completed', { label }), sev: 'ok' }
    if (data.status === 'FAILED') return { text: t('dashboard.event.failed', { label }) + (data.error ? ' · ' + String(data.error).slice(0, 80) : ''), sev: 'error' }
    return { text: t('dashboard.event.generic', { label, status: data.status ?? '' }), sev: 'info' }
  }
  if (e.type === 'urls_refreshed') return { text: t('dashboard.event.refreshedUrls', { n: data.count ?? 0 }), sev: 'info' }
  if (e.type === 'worker_tick') return { text: t('dashboard.event.workerTick'), sev: 'info' }
  return { text: e.type, sev: 'info' }
}

/** Hourly buckets over the last 24h, oldest first. */
function hourly(requests: Request[], pick: (r: Request) => boolean, now: number): number[] {
  const out = new Array<number>(24).fill(0)
  for (const r of requests) {
    if (!pick(r)) continue
    const age = now - new Date(r.updated_at).getTime()
    if (age < 0 || age >= 24 * HOUR) continue
    out[23 - Math.floor(age / HOUR)]++
  }
  return out
}

/** 7 days × 24 hours grid of request activity, most recent day last. */
function heat(requests: Request[], now: number): number[][] {
  const grid = Array.from({ length: 7 }, () => new Array<number>(24).fill(0))
  const start = new Date(now); start.setHours(0, 0, 0, 0)
  const dayStart = start.getTime() - 6 * 24 * HOUR
  for (const r of requests) {
    const ts = new Date(r.updated_at).getTime()
    if (ts < dayStart || ts > now) continue
    const d = new Date(ts)
    const dayIdx = Math.floor((ts - dayStart) / (24 * HOUR))
    if (dayIdx >= 0 && dayIdx < 7) grid[dayIdx][d.getHours()]++
  }
  return grid
}

function DashboardSkeleton() {
  return (
    <div className="fk-page">
      <Skeleton className="h-[110px] rounded-[14px]" />
      <div className="fk-stats">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-[92px] rounded-[14px]" />)}</div>
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]"><Skeleton className="h-[300px] rounded-[14px]" /><Skeleton className="h-[300px] rounded-[14px]" /></div>
    </div>
  )
}

export default function DashboardPage() {
  const { t, lang } = useTranslation()
  const navigate = useNavigate()
  const { events } = useWebSocketContext()
  const [projects, setProjects] = useState<Project[]>([])
  const [videosByProject, setVideosByProject] = useState<Record<string, Video[]>>({})
  const [scenesByVideo, setScenesByVideo] = useState<Record<string, Scene[]>>({})
  const [requests, setRequests] = useState<Request[]>([])
  const [characters, setCharacters] = useState<Character[]>([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async () => {
    setNow(Date.now())
    const active = await fetchAPI<Project[]>('/api/projects?status=ACTIVE')
    const videoLists = await Promise.all(active.map(p => fetchAPI<Video[]>(`/api/videos?project_id=${p.id}`)))
    const vbp: Record<string, Video[]> = {}
    active.forEach((p, i) => { vbp[p.id] = videoLists[i] })
    const allVideos = videoLists.flat()
    const sceneLists = await Promise.all(allVideos.map(v => fetchAPI<Scene[]>(`/api/scenes?video_id=${v.id}`)))
    const sbv: Record<string, Scene[]> = {}
    allVideos.forEach((v, i) => { sbv[v.id] = sceneLists[i] })
    const [allRequests, allChars] = await Promise.all([fetchAPI<Request[]>('/api/requests'), fetchAPI<Character[]>('/api/characters')])
    setProjects(active); setVideosByProject(vbp); setScenesByVideo(sbv); setRequests(allRequests); setCharacters(allChars)
    setLoading(false)
  }, [])

  useEffect(() => { Promise.resolve().then(load) }, [load])
  useReloadOnEvent(load)

  const spark = useMemo(() => ({
    completed: hourly(requests, r => r.status === 'COMPLETED', now),
    failed: hourly(requests, r => r.status === 'FAILED', now),
    all: hourly(requests, () => true, now),
  }), [requests, now])
  const heatmap = useMemo(() => heat(requests, now), [requests, now])
  const heatMax = Math.max(1, ...heatmap.flat())

  if (loading) return <DashboardSkeleton />

  const allVideos: VideoWithProject[] = projects.flatMap(p => (videosByProject[p.id] ?? []).map(v => ({ ...v, projectName: p.name, projectId: p.id })))

  const scenesInFlight = allVideos.reduce((sum, v) => sum + (scenesByVideo[v.id] ?? []).filter(s =>
    (['image', 'video', 'upscale'] as const).some(stage => sceneStageStatus(s, stage) === 'PROCESSING')).length, 0)
  const todayStr = new Date().toDateString()
  const completedToday = requests.filter(r => r.status === 'COMPLETED' && new Date(r.updated_at).toDateString() === todayStr).length
  const failed24h = requests.filter(r => r.status === 'FAILED' && now - new Date(r.updated_at).getTime() <= 24 * HOUR).length

  const stats: { id: string; labelKey: TranslationKey; value: number; tone: string; note: string; spark?: number[] }[] = [
    { id: 'inflight', labelKey: 'dashboard.kpi.scenesInFlight', value: scenesInFlight, tone: 'var(--busy)', note: t('dashboard.kpi.note.scenesInFlight', { n: allVideos.length }), spark: spark.all },
    { id: 'done', labelKey: 'dashboard.kpi.completedToday', value: completedToday, tone: 'var(--ok)', note: t('dashboard.kpi.note.completedToday', { n: requests.length }), spark: spark.completed },
    { id: 'failed', labelKey: 'dashboard.kpi.failed24h', value: failed24h, tone: 'var(--fail)', note: t('dashboard.kpi.note.failed24h', { n: requests.filter(r => r.status === 'FAILED').length }), spark: spark.failed },
    { id: 'projects', labelKey: 'dashboard.kpi.activeProjects', value: projects.length, tone: 'var(--accent)', note: t('dashboard.kpi.note.activeProjects', { n: allVideos.length }) },
  ]

  const strips = allVideos.map(v => {
    const scenes = scenesByVideo[v.id] ?? []
    const b = videoStageBreakdown(scenes)
    const total = scenes.length
    const slots = total * 3
    const doneSlots = b.image.done + b.video.done + b.upscale.done
    const pct = slots > 0 ? Math.round((doneSlots / slots) * 100) : 0
    const anyProcessing = requests.some(r => r.video_id === v.id && r.status === 'PROCESSING') || scenes.some(s => (['image', 'video', 'upscale'] as const).some(k => sceneStageStatus(s, k) === 'PROCESSING'))
    const failed = b.image.failed + b.video.failed + b.upscale.failed
    const allDone = total > 0 && doneSlots === slots
    const state: 'COMPLETED' | 'RUNNING' | 'QUEUED' = allDone ? 'COMPLETED' : anyProcessing ? 'RUNNING' : 'QUEUED'
    return { video: v, scenes, total, pct, failed, state }
  }).sort((a, b) => (a.state === b.state ? b.pct - a.pct : a.state === 'RUNNING' ? -1 : b.state === 'RUNNING' ? 1 : a.state === 'QUEUED' ? -1 : 1))

  const sceneIndex = new Map<string, { project: Project; video: Video; scene: Scene }>()
  projects.forEach(p => (videosByProject[p.id] ?? []).forEach(v => (scenesByVideo[v.id] ?? []).forEach(s => sceneIndex.set(s.id, { project: p, video: v, scene: s }))))
  const charIndex = new Map(characters.map(c => [c.id, c]))

  const attention = requests
    .filter(r => r.status === 'FAILED')
    .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))
    .slice(0, 6)
    .map(r => {
      const s = r.scene_id ? sceneIndex.get(r.scene_id) : undefined
      const c = r.character_id ? charIndex.get(r.character_id) : undefined
      const label = s ? `${s.video.title} · ${t('sceneCard.scene', { n: s.scene.display_order + 1 })}` : c ? c.name : r.id.slice(0, 8)
      return { id: r.id, label, type: r.type, time: r.updated_at, error: r.error_message, projectId: s?.project.id ?? r.project_id ?? undefined }
    })

  const recentEvents = events.slice(0, 10)
  const stageLabels = { image: t('common.stageTitle.image'), video: t('common.stageTitle.video'), upscale: t('common.stageTitle.upscale') }
  const dayFmt = new Intl.DateTimeFormat(lang, { weekday: 'short' })

  return (
    <div className="fk-page fk-fade">
      <HealthStrip />

      <div className="fk-stats">
        {stats.map(s => (
          <div key={s.id} className="fk-panel fk-stat">
            <span className="fk-stat-label">{t(s.labelKey)}</span>
            <span className="fk-stat-value" style={{ color: s.value > 0 ? s.tone : 'var(--fg-muted)' }}>{s.value}</span>
            {s.spark ? <span style={{ color: s.tone }}><Sparkline values={s.spark} /></span> : <Layers size={26} strokeWidth={1.2} className="text-fg-muted mb-0.5" />}
            <span className="fk-stat-note">{s.note}{s.spark ? ` · ${t('dashboard.stat.last24h')}` : ''}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-4 items-start lg:grid-cols-[1.6fr_1fr]">
        <Panel
          title={t('dashboard.throughput.title')}
          sub={t('dashboard.throughput.desc')}
          action={
            <span className="fk-strip-legend">
              <span><i style={{ background: 'var(--accent)' }} />{t('dashboard.legend.done')}</span>
              <span><i style={{ background: 'var(--busy)' }} />{t('dashboard.legend.busy')}</span>
              <span><i style={{ background: 'var(--fail)' }} />{t('dashboard.legend.fail')}</span>
            </span>
          }
        >
          {strips.length === 0 ? (
            <EmptyState icon={Clapperboard} title={t('dashboard.throughput.empty')} />
          ) : (
            <div className="flex flex-col -mx-2">
              {strips.map(r => (
                <div key={r.video.id} className="fk-strip" onClick={() => navigate(`/projects/${r.video.projectId}?tab=pipeline`)} role="link" tabIndex={0} onKeyDown={e => e.key === 'Enter' && navigate(`/projects/${r.video.projectId}?tab=pipeline`)}>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[13px] font-medium truncate">{r.video.title}</span>
                    <span className="text-[11px] text-fg-muted truncate">{r.video.projectName} · {t('common.scenes', { n: r.total })}</span>
                  </div>
                  <FilmStrip scenes={r.scenes} labels={stageLabels} />
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] font-semibold tabular-nums" style={{ color: r.state === 'COMPLETED' ? 'var(--ok)' : r.pct === 0 ? 'var(--fg-muted)' : 'var(--fg)' }}>{r.pct}%</span>
                    <Pill state={r.state === 'COMPLETED' ? 'ok' : r.state === 'RUNNING' ? 'RUNNING' : 'outline'} dot={r.state === 'RUNNING'}>{stateLabel(t, r.state)}</Pill>
                    <ArrowUpRight size={14} className="text-fg-muted hidden sm:block" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title={t('dashboard.attention.title')}
          sub={t('dashboard.attention.desc')}
          action={<span className="text-xl font-semibold tabular-nums" style={{ color: attention.length ? 'var(--fail)' : 'var(--fg-muted)' }}>{attention.length}</span>}
          style={attention.length ? { borderColor: 'rgba(255,107,107,.3)' } : undefined}
        >
          {attention.length === 0 ? (
            <EmptyState icon={CheckCircle2} title={t('dashboard.attention.empty')} />
          ) : (
            <div className="flex flex-col gap-2">
              {attention.map(a => (
                <div key={a.id} className="fk-alert" onClick={() => a.projectId && navigate(`/projects/${a.projectId}?tab=pipeline`)}>
                  <div className="row">
                    <AlertTriangle size={13} className="text-fail flex-shrink-0" />
                    <span className="text-[12px] truncate">{a.label}</span>
                    <span className="ml-auto text-[10px] font-mono text-fg-muted flex-shrink-0">{new Date(a.time).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="row">
                    <span className="fk-pill" data-s="FAILED" style={{ height: 18, fontSize: 10 }}>{a.type}</span>
                    {a.error && <span className="err truncate">{a.error}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 items-start lg:grid-cols-[1fr_1.6fr]">
        <Panel title={t('dashboard.activity.title')} sub={t('dashboard.activity.desc')}>
          {requests.length === 0 ? (
            <EmptyState icon={Activity} title={t('dashboard.activity.empty')} />
          ) : (
            <div className="flex flex-col gap-1.5" aria-label={t('dashboard.activity.title')}>
              {heatmap.map((row, di) => {
                const day = new Date(now - (6 - di) * 24 * HOUR)
                return (
                  <div key={di} className="grid items-center gap-2" style={{ gridTemplateColumns: '30px 1fr' }}>
                    <span className="text-[10px] text-fg-muted">{dayFmt.format(day)}</span>
                    <div className="grid gap-[2px]" style={{ gridTemplateColumns: 'repeat(24, 1fr)' }}>
                      {row.map((n, hi) => (
                        <span
                          key={hi}
                          title={`${dayFmt.format(day)} ${String(hi).padStart(2, '0')}:00 · ${n}`}
                          className="rounded-[2px]"
                          style={{ aspectRatio: '1', background: n === 0 ? 'rgba(255,255,255,.05)' : `color-mix(in srgb, var(--accent) ${25 + Math.round((n / heatMax) * 75)}%, transparent)` }}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
              <div className="grid" style={{ gridTemplateColumns: '30px 1fr' }}>
                <span />
                <div className="flex justify-between text-[10px] text-fg-muted font-mono"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
              </div>
            </div>
          )}
        </Panel>

        <Panel
          title={t('dashboard.events.title')}
          action={<button className="text-[12px] text-brand hover:underline underline-offset-4 bg-transparent border-0 p-0 font-[inherit]" onClick={() => navigate('/logs')}>{t('dashboard.events.openLogs')}</button>}
        >
          {recentEvents.length === 0 ? (
            <EmptyState icon={Inbox} title={t('dashboard.events.empty')} />
          ) : (
            <div className="fk-events">
              {recentEvents.map((e, i) => {
                const d = describeEvent(t, e, requests)
                return (
                  <div key={i} className="fk-event" data-sev={d.sev}>
                    <time>{new Date(e.timestamp).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
                    <span className="type">{e.type}</span>
                    <span className="msg">{d.text}</span>
                  </div>
                )
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
