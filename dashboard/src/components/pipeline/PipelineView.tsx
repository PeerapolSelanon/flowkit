import { useState, useEffect, useCallback } from 'react'
import { ArrowDownAZ, AlertOctagon, Users } from 'lucide-react'
import { fetchAPI } from '../../api/client'
import { useReloadOnEvent } from '../../api/useReloadOnEvent'
import { useTranslation } from '../../i18n/useTranslation'
import type { TranslationKey } from '../../i18n/translations'
import { statusLabel, stateLabel } from '../../i18n/labels'
import type { Project, Video, Character, Scene, Request, SceneReview, StatusType } from '../../types'
import { count, sceneStageStatus, charStatus, latestRequest, type SceneStage } from '../../lib/stageStats'
import { Skeleton } from '../ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import Thumb from '../common/Thumb'
import EmptyState from '../common/EmptyState'
import { Dot, Pill } from '../common/status'
import StageNode from './StageNode'
import SceneCard from './SceneCard'
import SceneDetailSheet from './SceneDetailSheet'

type StageKey = 'refs' | 'image' | 'video' | 'upscale'

interface PipelineViewProps { projectId: string; videoId: string }

const STAGE_META: { key: StageKey; idx: string; nameKey: TranslationKey; subtitleKey: TranslationKey }[] = [
  { key: 'refs', idx: '01', nameKey: 'pipeline.railName.refs', subtitleKey: 'pipeline.railSubtitle.refs' },
  { key: 'image', idx: '02', nameKey: 'pipeline.railName.image', subtitleKey: 'pipeline.railSubtitle.image' },
  { key: 'video', idx: '03', nameKey: 'pipeline.railName.video', subtitleKey: 'pipeline.railSubtitle.video' },
  { key: 'upscale', idx: '04', nameKey: 'pipeline.railName.upscale', subtitleKey: 'pipeline.railSubtitle.upscale' },
]

const RETRY_TYPE: Record<SceneStage, string> = { image: 'REGENERATE_IMAGE', video: 'REGENERATE_VIDEO', upscale: 'UPSCALE_VIDEO' }

export default function PipelineView({ projectId, videoId }: PipelineViewProps) {
  const { t } = useTranslation()
  const [project, setProject] = useState<Project | null>(null)
  const [video, setVideo] = useState<Video | null>(null)
  const [characters, setCharacters] = useState<Character[]>([])
  const [scenes, setScenes] = useState<Scene[]>([])
  const [requests, setRequests] = useState<Request[]>([])
  const [loaded, setLoaded] = useState(false)

  const [activeStage, setActiveStage] = useState<StageKey>('image')
  const [sortFailedFirst, setSortFailedFirst] = useState(false)
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [reviews, setReviews] = useState<Record<string, SceneReview>>({})
  const [reviewRunning, setReviewRunning] = useState<{ sceneId: string; mode: 'light' | 'deep' } | null>(null)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [retryingSceneId, setRetryingSceneId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [p, v, c, s, r] = await Promise.all([
      fetchAPI<Project>(`/api/projects/${projectId}`),
      fetchAPI<Video>(`/api/videos/${videoId}`),
      fetchAPI<Character[]>(`/api/projects/${projectId}/characters`),
      fetchAPI<Scene[]>(`/api/scenes?video_id=${videoId}`),
      fetchAPI<Request[]>(`/api/requests?project_id=${projectId}`),
    ])
    setProject(p); setVideo(v); setCharacters(c); setScenes(s); setRequests(r); setLoaded(true)
  }, [projectId, videoId])

  useEffect(() => { load() }, [load])
  useReloadOnEvent(load)

  const videoRequests = requests.filter(r => r.video_id === videoId)
  const anyProcessing = videoRequests.some(r => r.status === 'PROCESSING') || scenes.some(s => (['image', 'video', 'upscale'] as const).some(k => sceneStageStatus(s, k) === 'PROCESSING'))
  const pendingCount = videoRequests.filter(r => r.status === 'PENDING').length

  const breakdown: Record<StageKey, ReturnType<typeof count>> = {
    refs: count(characters.map(c => charStatus(c, requests))),
    image: count(scenes.map(s => sceneStageStatus(s, 'image'))),
    video: count(scenes.map(s => sceneStageStatus(s, 'video'))),
    upscale: count(scenes.map(s => sceneStageStatus(s, 'upscale'))),
  }

  let gridScenes = scenes.slice().sort((a, b) => a.display_order - b.display_order)
  if (activeStage !== 'refs' && sortFailedFirst) {
    const rank: Record<StatusType, number> = { FAILED: 0, PROCESSING: 1, PENDING: 2, COMPLETED: 3 }
    gridScenes = gridScenes.sort((a, b) => rank[sceneStageStatus(a, activeStage as SceneStage)] - rank[sceneStageStatus(b, activeStage as SceneStage)])
  }

  const selectedScene = scenes.find(s => s.id === selectedSceneId) ?? null
  const sheetStage = activeStage === 'refs' ? 'image' : (activeStage as SceneStage)
  const sheetStageMeta = STAGE_META.find(m => m.key === activeStage)!
  const activeMeta = STAGE_META.find(m => m.key === activeStage)!

  function openScene(sceneId: string) { setSelectedSceneId(sceneId); setSheetOpen(true); setReviewError(null) }

  async function runReview(mode: 'light' | 'deep') {
    if (!selectedScene) return
    setReviewRunning({ sceneId: selectedScene.id, mode }); setReviewError(null)
    try {
      const result = await fetchAPI<SceneReview>(`/api/videos/${videoId}/scenes/${selectedScene.id}/review?project_id=${projectId}&mode=${mode}`, { method: 'POST' })
      setReviews(prev => ({ ...prev, [selectedScene.id]: result }))
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : 'Review failed')
    } finally { setReviewRunning(null) }
  }

  async function retryStage() {
    if (!selectedScene) return
    setRetryingSceneId(selectedScene.id)
    try {
      await fetchAPI('/api/requests', { method: 'POST', body: JSON.stringify({ type: RETRY_TYPE[sheetStage], scene_id: selectedScene.id, project_id: projectId, video_id: videoId }) })
      await load()
    } catch (e) { console.error(e) } finally { setRetryingSceneId(null) }
  }

  if (!loaded) {
    return (
      <div className="flex flex-col gap-4">
        <div className="fk-rail">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-[118px] rounded-[12px]" />)}</div>
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-[240px] rounded-[12px]" />)}</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[11px] text-fg-muted truncate">{project?.name}</span>
          <div className="flex items-baseline gap-3">
            <h2 className="m-0 text-[17px] font-semibold tracking-tight truncate">{video?.title ?? '…'}</h2>
            <span className="text-[12px] text-fg-muted whitespace-nowrap">{t('common.scenes', { n: scenes.length })}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {characters.length > 0 && (
            <div className="flex items-center -space-x-2">
              {characters.slice(0, 6).map(c => (
                <Tooltip key={c.id}>
                  <TooltipTrigger asChild>
                    <span className="block"><Thumb src={c.reference_image_url} alt={c.name} status={charStatus(c, requests)} className="w-8 h-8 !rounded-full border-2 border-card" /></span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="flex flex-col gap-0.5 max-w-[240px]">
                      <span className="font-medium">{c.name} · {c.entity_type}</span>
                      {c.description && <span className="opacity-75 leading-snug">{c.description}</span>}
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
              {characters.length > 6 && <span className="w-8 h-8 rounded-full grid place-items-center text-[11px] bg-card-2 border-2 border-card">+{characters.length - 6}</span>}
            </div>
          )}
          <Pill state={anyProcessing ? 'RUNNING' : 'outline'} dot={anyProcessing}>{stateLabel(t, anyProcessing ? 'RUNNING' : 'IDLE')}</Pill>
          <span className="text-[12px] text-fg-muted">{t('pipeline.queue', { n: pendingCount })}</span>
        </div>
      </div>

      {/* Stage rail */}
      <div className="fk-rail">
        {STAGE_META.map(m => (
          <StageNode key={m.key} idx={m.idx} name={t(m.nameKey)} subtitle={t(m.subtitleKey)} {...breakdown[m.key]} isActive={activeStage === m.key} onClick={() => setActiveStage(m.key)} />
        ))}
      </div>

      {activeStage === 'refs' ? (
        <div className="flex flex-col gap-3">
          <div className="fk-section-head"><h2>{t('pipeline.refsHeading', { n: characters.length })}</h2></div>
          {characters.length === 0 ? (
            <div className="fk-panel"><EmptyState icon={Users} title={t('projectDetail.noCharacters')} /></div>
          ) : (
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
              {characters.map(c => {
                const st = charStatus(c, requests)
                return (
                  <div key={c.id} className="fk-panel overflow-hidden flex flex-col">
                    <Thumb src={c.reference_image_url} alt={c.name} status={st} aspect="3/4" className="!rounded-none" emptyLabel={t('pipeline.noImage')} />
                    <div className="p-2.5 flex flex-col gap-1">
                      <span className="text-[12px] font-medium truncate">{c.name}</span>
                      <span className="text-[11px] text-fg-muted">{c.entity_type}</span>
                      <span className="flex items-center gap-1.5 text-[11px] text-fg-2"><Dot state={st} />{statusLabel(t, st)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="fk-section-head">
              <h2>{t('pipeline.stageHeading', { idx: activeMeta.idx, name: t(activeMeta.nameKey) })}</h2>
              <p>{t(activeMeta.subtitleKey)}</p>
            </div>
            <div className="fk-seg" role="group" aria-label={t('pipeline.sort')}>
              <button aria-pressed={!sortFailedFirst} onClick={() => setSortFailedFirst(false)}><ArrowDownAZ size={13} className="inline mr-1 -mt-0.5" />{t('pipeline.sortSceneOrder')}</button>
              <button aria-pressed={sortFailedFirst} onClick={() => setSortFailedFirst(true)}><AlertOctagon size={13} className="inline mr-1 -mt-0.5" />{t('pipeline.sortFailuresFirst')}</button>
            </div>
          </div>

          {gridScenes.length === 0 ? (
            <div className="fk-panel"><EmptyState title={t('projectDetail.pipeline.noVideos')} /></div>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
              {gridScenes.map(scene => {
                const stage = activeStage as SceneStage
                const req = latestRequest(requests, scene.id, stage)
                return <SceneCard key={scene.id} scene={scene} stage={stage} retries={req?.retry_count ?? 0} verdict={stage === 'video' ? reviews[scene.id]?.verdict : undefined} onClick={() => openScene(scene.id)} />
              })}
            </div>
          )}
        </div>
      )}

      <SceneDetailSheet
        key={selectedSceneId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        scene={selectedScene}
        stage={sheetStage}
        stageName={t(sheetStageMeta.nameKey)}
        characters={characters}
        requests={selectedScene ? requests.filter(r => r.scene_id === selectedScene.id) : []}
        review={selectedScene ? reviews[selectedScene.id] : undefined}
        reviewRunning={!!selectedScene && reviewRunning?.sceneId === selectedScene.id}
        runningMode={reviewRunning?.mode ?? null}
        reviewError={reviewError}
        onRunReview={runReview}
        onRetry={retryStage}
        retrying={!!selectedScene && retryingSceneId === selectedScene.id}
      />
    </div>
  )
}
