import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, Mic, Users, Film } from 'lucide-react'
import { fetchAPI, patchAPI } from '../api/client'
import type { Project, Character, Video, Scene, Request } from '../types'
import EditableText from '../components/projects/EditableText'
import PipelineView from '../components/pipeline/PipelineView'
import { count, charStatus, videoStageBreakdown, type SceneStage } from '../lib/stageStats'
import { useTranslation } from '../i18n/useTranslation'
import { statusLabel, stateLabel, projectStatusLabel, stageTitleLabel } from '../i18n/labels'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { Button } from '../components/ui/button'
import { Skeleton } from '../components/ui/skeleton'
import Panel from '../components/common/Panel'
import Thumb from '../components/common/Thumb'
import EmptyState from '../components/common/EmptyState'
import { Bar, Dot, Pill } from '../components/common/status'

type Tab = 'overview' | 'characters' | 'videos' | 'pipeline'
const STAGE_KEYS: ('refs' | SceneStage)[] = ['refs', 'image', 'video', 'upscale']

interface Props { projectId: string; onBack: () => void }

export default function ProjectDetailPage({ projectId, onBack }: Props) {
  const { t, lang } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = (searchParams.get('tab') as Tab) ?? 'overview'

  const [project, setProject] = useState<Project | null>(null)
  const [characters, setCharacters] = useState<Character[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [scenesByVideo, setScenesByVideo] = useState<Record<string, Scene[]>>({})
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [pipelineVideoId, setPipelineVideoId] = useState<string>('')

  const fetchAll = useCallback(async () => {
    const [proj, chars, vids] = await Promise.all([
      fetchAPI<Project>(`/api/projects/${projectId}`),
      fetchAPI<Character[]>(`/api/projects/${projectId}/characters`),
      fetchAPI<Video[]>(`/api/videos?project_id=${projectId}`),
    ])
    const sceneLists = await Promise.all(vids.map(v => fetchAPI<Scene[]>(`/api/scenes?video_id=${v.id}`)))
    const sbv: Record<string, Scene[]> = {}
    vids.forEach((v, i) => { sbv[v.id] = sceneLists[i] })
    const reqs = await fetchAPI<Request[]>(`/api/requests?project_id=${projectId}`)
    setProject(proj); setCharacters(chars); setVideos(vids); setScenesByVideo(sbv); setRequests(reqs)
    setPipelineVideoId(prev => prev && vids.some(v => v.id === prev) ? prev : (vids[0]?.id ?? ''))
    setLoading(false)
  }, [projectId])

  useEffect(() => { Promise.resolve().then(fetchAll) }, [fetchAll])

  function setTab(next: Tab) {
    setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('tab', next); return n })
  }
  async function patchProject(field: string, value: string) { await patchAPI(`/api/projects/${projectId}`, { [field]: value }); fetchAll() }
  async function patchChar(cid: string, field: string, value: string) { await patchAPI(`/api/characters/${cid}`, { [field]: value }); fetchAll() }

  if (loading || !project) {
    return (
      <div className="fk-page">
        <Skeleton className="h-[180px] rounded-[14px]" />
        <Skeleton className="h-[34px] w-[360px] rounded-[10px]" />
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]"><Skeleton className="h-[320px] rounded-[14px]" /><Skeleton className="h-[320px] rounded-[14px]" /></div>
      </div>
    )
  }

  const allScenes = videos.flatMap(v => scenesByVideo[v.id] ?? [])
  const rollup: Record<'refs' | SceneStage, ReturnType<typeof count>> = { refs: count(characters.map(c => charStatus(c, requests))), ...videoStageBreakdown(allScenes) }
  const tier = project.user_paygate_tier?.includes('TWO') ? t('projects.tier2') : project.user_paygate_tier ? t('projects.tier1') : null
  const created = new Date(project.created_at).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="fk-page fk-fade">
      {/* Hero banner */}
      <section className="fk-panel overflow-hidden relative">
        <Thumb src={project.thumbnail_url} alt="" aspect="16/5" className="!rounded-none" style={{ maxHeight: 220, minHeight: 120 }}>
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, var(--card) 8%, rgba(21,24,33,.6) 55%, rgba(21,24,33,.15))' }} />
          <Button variant="outline" size="sm" className="absolute left-4 top-4 backdrop-blur" onClick={onBack}><ArrowLeft /> {t('projectDetail.back')}</Button>
        </Thumb>
        <div className="px-4 pb-4 -mt-6 sm:absolute sm:left-5 sm:right-5 sm:bottom-4 sm:p-0 sm:mt-0 relative flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="fk-title line-clamp-2">{project.name}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Pill state={project.status === 'ACTIVE' ? 'ok' : 'outline'}>{projectStatusLabel(t, project.status)}</Pill>
                {project.material && <Pill state="outline">{project.material}</Pill>}
                {tier && <Pill state="brand">{tier}</Pill>}
              </div>
            </div>
            <div className="flex gap-5 text-[12px] text-fg-2">
              <span className="flex items-center gap-1.5"><Film size={13} /> {t('common.videos', { n: videos.length })}</span>
              <span className="flex items-center gap-1.5"><Users size={13} /> {t('common.characters', { n: characters.length })}</span>
              <span className="hidden sm:inline">{created}</span>
            </div>
        </div>
      </section>

      <Tabs value={tab} onValueChange={v => setTab(v as Tab)}>
        <div className="flex flex-wrap items-center gap-3">
          <TabsList>
            <TabsTrigger value="overview">{t('projectDetail.tab.overview')}</TabsTrigger>
            <TabsTrigger value="characters">{t('projectDetail.tab.characters', { n: characters.length })}</TabsTrigger>
            <TabsTrigger value="videos">{t('projectDetail.tab.videos', { n: videos.length })}</TabsTrigger>
            <TabsTrigger value="pipeline">{t('projectDetail.tab.pipeline')}</TabsTrigger>
          </TabsList>
          <span className="ml-auto font-mono text-[10px] text-fg-muted hidden sm:inline">{project.id}</span>
        </div>

        <TabsContent value="overview" className="pt-4">
          <div className="grid gap-4 items-start lg:grid-cols-[1.4fr_1fr]">
            <Panel title={t('projectDetail.card.projectFields')} sub={t('editableText.clickToEdit')}>
              <div className="flex flex-col gap-4">
                {[
                  { label: t('projectDetail.field.name'), value: project.name, field: 'name', multiline: false },
                  { label: t('projectDetail.field.description'), value: project.description ?? '', field: 'description', multiline: true },
                  { label: t('projectDetail.field.story'), value: project.story ?? '', field: 'story', multiline: true },
                ].map(f => (
                  <div key={f.field} className="fk-field">
                    <span className="fk-label">{f.label}</span>
                    <div className="fk-inset px-3 py-2.5 text-[13px] leading-relaxed">
                      <EditableText value={f.value} onSave={v => patchProject(f.field, v)} multiline={f.multiline} />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <div className="flex flex-col gap-4">
              <Panel title={t('projectDetail.card.stageRollup')}>
                <div className="fk-tracks" style={{ gap: 8 }}>
                  {STAGE_KEYS.map(key => {
                    const c = rollup[key]
                    return (
                      <div key={key} className="fk-track" style={{ gridTemplateColumns: '80px 1fr 48px' }}>
                        <span className="!text-fg">{stageTitleLabel(t, key)}</span>
                        <Bar done={c.done} busy={c.processing} fail={c.failed} total={c.total} />
                        <span>{c.done}/{c.total}</span>
                      </div>
                    )
                  })}
                </div>
              </Panel>

              <Panel title={t('projectDetail.card.narrator')} action={<Mic size={15} className="text-fg-muted" />}>
                <dl className="fk-kv">
                  <dt>{t('projectDetail.narrator.enabled')}</dt>
                  <dd><Pill state={project.narrator_voice ? 'ok' : 'outline'}>{project.narrator_voice ? t('projectDetail.true') : t('projectDetail.false')}</Pill></dd>
                  <dt>{t('projectDetail.narrator.voice')}</dt>
                  <dd>{project.narrator_voice ?? t('projectDetail.noNarration')}</dd>
                  <dt>{t('projectDetail.narrator.refAudio')}</dt>
                  <dd className="mono">{project.narrator_ref_audio ?? t('common.dash')}</dd>
                </dl>
              </Panel>

              {characters.length > 0 && (
                <Panel title={t('pipeline.castEntities')} action={<button className="text-[12px] text-brand bg-transparent border-0 p-0 font-[inherit] hover:underline underline-offset-4" onClick={() => setTab('characters')}>{t('common.viewAll')}</button>}>
                  <div className="flex flex-wrap gap-2">
                    {characters.map(c => (
                      <div key={c.id} className="flex items-center gap-2 pr-3 rounded-full fk-inset" title={c.description ?? c.name}>
                        <Thumb src={c.reference_image_url} alt={c.name} status={charStatus(c, requests)} className="!rounded-full w-7 h-7 flex-shrink-0" />
                        <span className="text-[12px] truncate max-w-[140px]">{c.name}</span>
                      </div>
                    ))}
                  </div>
                </Panel>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="characters" className="pt-4">
          {characters.length === 0 ? (
            <div className="fk-panel"><EmptyState icon={Users} title={t('projectDetail.noCharacters')} /></div>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' }}>
              {characters.map(ch => {
                const st = charStatus(ch, requests)
                return (
                  <article key={ch.id} className="fk-panel overflow-hidden flex flex-col">
                    <Thumb src={ch.reference_image_url} alt={ch.name} status={st} aspect="1/1" className="!rounded-none" emptyLabel={st === 'PROCESSING' ? t('projectDetail.character.generating') : t('projectDetail.character.noReference')}>
                      <span className="fk-corner left-2.5 top-2.5"><Dot state={st} />{statusLabel(t, st)}</span>
                      <span className="fk-corner right-2.5 top-2.5">{ch.entity_type}</span>
                    </Thumb>
                    <div className="p-3.5 flex flex-col gap-2">
                      <h3 className="m-0 text-[13px] font-semibold">{ch.name}</h3>
                      <div className="text-[12px] text-fg-2 leading-relaxed">
                        <EditableText value={ch.description ?? ''} onSave={v => patchChar(ch.id, 'description', v)} multiline />
                      </div>
                      <span className="text-[11px] text-fg-muted">{t('projectDetail.character.updated', { date: new Date(ch.updated_at).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' }) })}</span>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="videos" className="pt-4">
          {videos.length === 0 ? (
            <div className="fk-panel"><EmptyState icon={Film} title={t('projectDetail.noVideos')} /></div>
          ) : (
            <Panel flush>
              <div className="fk-table-wrap">
                <table className="fk-table">
                  <thead>
                    <tr>
                      <th>{t('projectDetail.table.video')}</th>
                      <th>{t('projectDetail.table.scenes')}</th>
                      <th style={{ width: 260 }}>{t('projectDetail.table.progress')}</th>
                      <th>{t('projectDetail.table.state')}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {videos.map(v => {
                      const scenes = scenesByVideo[v.id] ?? []
                      const b = videoStageBreakdown(scenes)
                      const total = scenes.length * 3
                      const done = b.image.done + b.video.done + b.upscale.done
                      const busy = b.image.processing + b.video.processing + b.upscale.processing
                      const fail = b.image.failed + b.video.failed + b.upscale.failed
                      const pct = total > 0 ? Math.round((done / total) * 100) : 0
                      const anyProcessing = busy > 0 || requests.some(r => r.video_id === v.id && r.status === 'PROCESSING')
                      const state: 'COMPLETED' | 'RUNNING' | 'QUEUED' = pct === 100 && scenes.length > 0 ? 'COMPLETED' : anyProcessing ? 'RUNNING' : 'QUEUED'
                      return (
                        <tr key={v.id}>
                          <td>
                            <div className="flex items-center gap-3">
                              <Thumb src={v.thumbnail_url ?? scenes.find(s => s.vertical_image_url)?.vertical_image_url} alt="" className="w-14 h-9 flex-shrink-0 !rounded-md" />
                              <div className="min-w-0">
                                <div className="text-[13px] font-medium truncate">{v.title}</div>
                                <div className="mono">{v.id.slice(0, 8)}{v.resolution ? ` · ${v.resolution}` : ''}{v.duration ? ` · ${Math.round(v.duration)}s` : ''}</div>
                              </div>
                            </div>
                          </td>
                          <td className="tabular-nums">{scenes.length}</td>
                          <td>
                            <div className="flex items-center gap-3">
                              <Bar done={done} busy={busy} fail={fail} total={total} className="flex-1" />
                              <span className="tabular-nums text-[12px] w-9 text-right">{pct}%</span>
                            </div>
                          </td>
                          <td><Pill state={state === 'COMPLETED' ? 'ok' : state === 'RUNNING' ? 'RUNNING' : 'outline'} dot={state === 'RUNNING'}>{stateLabel(t, state)}</Pill></td>
                          <td className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => { setPipelineVideoId(v.id); setTab('pipeline') }}>{t('projectDetail.pipelineLink')} <ArrowUpRight /></Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </TabsContent>

        <TabsContent value="pipeline" className="pt-4">
          {videos.length === 0 ? (
            <div className="fk-panel"><EmptyState icon={Film} title={t('projectDetail.pipeline.noVideos')} /></div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="fk-label">{t('projectDetail.pipeline.videoLabel')}</span>
                <div className="fk-seg flex-wrap">
                  {videos.map(v => <button key={v.id} aria-pressed={v.id === pipelineVideoId} onClick={() => setPipelineVideoId(v.id)}>{v.title}</button>)}
                </div>
              </div>
              {pipelineVideoId && <PipelineView projectId={projectId} videoId={pipelineVideoId} />}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
