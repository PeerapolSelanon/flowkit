import { useState } from 'react'
import { Copy, RotateCcw, Sparkles, Zap, Check } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '../ui/sheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../ui/accordion'
import { Button } from '../ui/button'
import { useTranslation } from '../../i18n/useTranslation'
import { statusLabel, dimensionLabel, stageTitleLabel } from '../../i18n/labels'
import type { Scene, Character, Request, SceneReview } from '../../types'
import { sceneStageStatus, STAGE_TYPES, type SceneStage } from '../../lib/stageStats'
import Thumb from '../common/Thumb'
import { Dot, Pill } from '../common/status'

const VERDICT_TONE: Record<string, string> = { excellent: 'var(--ok)', good: 'var(--ok)', acceptable: 'var(--busy)', poor: 'var(--fail)', unusable: 'var(--fail)' }
const SEV_TONE: Record<string, string> = { CRITICAL: 'var(--fail)', HIGH: 'var(--busy)', MINOR: 'var(--fg-muted)' }
const scoreTone = (v: number) => (v >= 8 ? 'var(--ok)' : v >= 6 ? 'var(--busy)' : 'var(--fail)')

function parseCharNames(raw: string | null): string[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

function stageOutputUrl(scene: Scene, stage: SceneStage): string | null {
  if (stage === 'image') return scene.vertical_image_url || scene.horizontal_image_url
  if (stage === 'video') return scene.vertical_video_url || scene.horizontal_video_url
  return scene.vertical_upscale_url || scene.horizontal_upscale_url
}

function latestOfTypes(requests: Request[], types: string[]): Request | undefined {
  return requests.filter(r => types.includes(r.type)).sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))[0]
}

interface SceneDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  scene: Scene | null
  stage: SceneStage
  stageName: string
  characters: Character[]
  requests: Request[]
  review?: SceneReview
  reviewRunning: boolean
  runningMode: 'light' | 'deep' | null
  reviewError?: string | null
  onRunReview: (mode: 'light' | 'deep') => void
  onRetry: () => void
  retrying: boolean
}

export default function SceneDetailSheet({ open, onOpenChange, scene, stage, stageName, characters, requests, review, reviewRunning, runningMode, reviewError, onRunReview, onRetry, retrying }: SceneDetailSheetProps) {
  const { t, lang } = useTranslation()
  const [tab, setTab] = useState('output')
  const [copied, setCopied] = useState(false)

  if (!scene) return null

  const status = sceneStageStatus(scene, stage)
  const prompt = stage === 'video' ? scene.video_prompt : stage === 'image' ? scene.image_prompt : null
  const outputUrl = stageOutputUrl(scene, stage)
  const castNames = parseCharNames(scene.character_names)
  const refs = characters.filter(c => castNames.includes(c.name))
  const currentRequest = latestOfTypes(requests, STAGE_TYPES[stage])
  const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'medium' }) : t('common.dash'))

  function copyPrompt() {
    if (!prompt) return
    navigator.clipboard.writeText(prompt).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col p-0 gap-0 w-full sm:w-auto" style={{ width: 'min(1040px, 100vw)', maxWidth: 'none' }}>
        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-line">
          <SheetHeader className="p-0 gap-1.5">
            <SheetTitle className="text-[17px]">{t('sceneSheet.sceneTitle', { n: scene.display_order + 1 })}</SheetTitle>
            <SheetDescription className="text-[12px] font-mono">{t('sceneSheet.subtitle', { stage: stageName.toLowerCase(), id: scene.id })}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-wrap items-center gap-2.5 mt-3">
            <Pill state={status} dot>{statusLabel(t, status)}</Pill>
            <Pill state="outline">{stageTitleLabel(t, stage)}</Pill>
            <span className="text-[12px] text-fg-muted">{t('sceneSheet.retryOf3', { n: currentRequest?.retry_count ?? 0 })}</span>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-4">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="output">{t('sceneSheet.tab.output')}</TabsTrigger>
              <TabsTrigger value="review">{t('sceneSheet.tab.review')}</TabsTrigger>
              <TabsTrigger value="stages">{t('sceneSheet.tab.stages')}</TabsTrigger>
            </TabsList>

            <TabsContent value="output">
              <div className="flex flex-col gap-5 pt-4">
                {status === 'FAILED' && currentRequest?.error_message && (
                  <div className="fk-field">
                    <span className="fk-label text-fail">{t('sceneSheet.error')}</span>
                    <pre className="fk-code is-error">{currentRequest.error_message}</pre>
                  </div>
                )}

                <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr] items-start">
                  <div className="fk-field">
                    <span className="fk-label">{t('sceneSheet.output')}</span>
                    <Thumb src={stage === 'image' ? outputUrl : null} alt={t('sceneSheet.output')} status={status} aspect="16/9" emptyLabel={status === 'FAILED' ? t('sceneSheet.noOutputFailed') : t('sceneSheet.notGenerated')}>
                      {stage !== 'image' && outputUrl && <video src={outputUrl} controls playsInline preload="metadata" />}
                    </Thumb>
                  </div>
                  <div className="fk-field">
                    <span className="fk-label">{t('sceneSheet.prompt')}</span>
                    {prompt ? <pre className="fk-code">{prompt}</pre> : <div className="fk-inset px-3 py-2.5 text-[12px] text-fg-muted">{stage === 'upscale' ? t('sceneSheet.noPromptUpscale') : t('sceneSheet.noPromptSet')}</div>}
                    {scene.narrator_text && (
                      <>
                        <span className="fk-label mt-2">{t('sceneSheet.narration')}</span>
                        <div className="fk-inset px-3 py-2.5 text-[12.5px] leading-relaxed">{scene.narrator_text}</div>
                      </>
                    )}
                  </div>
                </div>

                {refs.length > 0 && (
                  <div className="fk-field">
                    <span className="fk-label">{t('sceneSheet.referenceMediaUsed', { n: refs.length })}</span>
                    <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
                      {refs.map(r => (
                        <div key={r.id} className="fk-inset overflow-hidden">
                          <Thumb src={r.reference_image_url} alt={r.name} aspect="1/1" className="!rounded-none" emptyLabel={t('sceneSheet.noRef')} />
                          <div className="px-2.5 py-2 flex flex-col">
                            <span className="text-[12px] truncate">{r.name}</span>
                            <span className="text-[11px] text-fg-muted">{r.entity_type}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="fk-field">
                  <span className="fk-label">{t('sceneSheet.generationMetadata')}</span>
                  <dl className="fk-kv fk-inset px-4 py-3">
                    <dt>{t('sceneSheet.meta.status')}</dt><dd><Pill state={status} dot>{statusLabel(t, status)}</Pill></dd>
                    <dt>{t('sceneSheet.meta.mediaId')}</dt><dd className="mono">{currentRequest?.media_id ?? t('common.dash')}</dd>
                    <dt>{t('sceneSheet.meta.outputUrl')}</dt><dd className="mono">{currentRequest?.output_url ?? t('common.dash')}</dd>
                    <dt>{t('sceneSheet.meta.retryCount')}</dt><dd>{t('sceneSheet.retryCountOf3', { n: currentRequest?.retry_count ?? 0 })}</dd>
                    <dt>{t('sceneSheet.meta.createdAt')}</dt><dd className="mono">{fmt(currentRequest?.created_at)}</dd>
                    <dt>{t('sceneSheet.meta.updatedAt')}</dt><dd className="mono">{fmt(currentRequest?.updated_at)}</dd>
                  </dl>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="review">
              <div className="flex flex-col gap-5 pt-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="outline" size="sm" disabled={reviewRunning} onClick={() => onRunReview('light')}><Zap /> {t('sceneSheet.runLight')}</Button>
                  <Button size="sm" disabled={reviewRunning} onClick={() => onRunReview('deep')}><Sparkles /> {t('sceneSheet.runDeep')}</Button>
                  {review && !reviewRunning && <span className="text-[11px] text-fg-muted">{t('sceneSheet.lastRun', { fps: review.fps_used, frames: review.frames_analyzed })}</span>}
                </div>

                {reviewError && !reviewRunning && <pre className="fk-code is-error">{reviewError}</pre>}

                {reviewRunning && (
                  <div className="fk-inset p-4 flex flex-col gap-2" style={{ borderColor: 'rgba(245,183,61,.4)', background: 'var(--busy-soft)' }}>
                    <span className="flex items-center gap-2 text-[12px] text-busy"><Dot state="busy" />{t('sceneSheet.analyzing', { mode: runningMode === 'deep' ? t('sceneSheet.modeDeep') : t('sceneSheet.modeLight') })}</span>
                    <span className="text-[12px] text-fg-2">{t('sceneSheet.analyzingBody')}</span>
                  </div>
                )}

                {review && !reviewRunning && (
                  <div className="flex flex-col gap-5">
                    <div className="fk-inset p-4 grid grid-cols-2 gap-4" style={{ borderLeft: `3px solid ${VERDICT_TONE[review.verdict] ?? 'var(--fg-muted)'}` }}>
                      <div className="flex flex-col gap-1">
                        <span className="fk-label">{t('sceneSheet.verdict')}</span>
                        <span className="text-[26px] font-semibold leading-none" style={{ color: VERDICT_TONE[review.verdict] ?? 'var(--fg)' }}>{review.verdict}</span>
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        <span className="fk-label">{t('sceneSheet.overall')}</span>
                        <span className="text-[26px] font-semibold leading-none tabular-nums" style={{ color: VERDICT_TONE[review.verdict] ?? 'var(--fg)' }}>{review.overall_score.toFixed(1)}<span className="text-[13px] text-fg-muted font-normal"> / 10</span></span>
                      </div>
                    </div>

                    <div className="fk-field">
                      <span className="fk-label">{t('sceneSheet.dimensionScores')}</span>
                      <div className="fk-inset px-4 py-1">
                        {Object.entries(review.dimensions).map(([key, score]) => (
                          <div key={key} className="fk-score">
                            <span>{dimensionLabel(t, key)}</span>
                            <div className="fk-bar"><i data-k="done" style={{ width: `${score * 10}%`, background: scoreTone(score) }} /></div>
                            <span className="text-right tabular-nums" style={{ color: scoreTone(score) }}>{score.toFixed(1)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {review.errors.length > 0 && (
                      <div className="fk-field">
                        <span className="fk-label">{t('sceneSheet.detectedErrors', { n: review.errors.length })}</span>
                        <div className="flex flex-col gap-2">
                          {review.errors.map((e, i) => (
                            <div key={i} className="fk-inset p-3 grid gap-2 sm:grid-cols-[auto_88px_1fr] items-start" style={{ borderLeft: `3px solid ${SEV_TONE[e.severity] ?? 'var(--fg-muted)'}` }}>
                              <span className="text-[11px] font-medium" style={{ color: SEV_TONE[e.severity] ?? 'var(--fg-muted)' }}>{e.severity}</span>
                              <span className="text-[11px] font-mono text-fg-muted">{e.time_range}</span>
                              <span className="text-[12px] leading-relaxed">{e.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {review.usable_segments.length > 0 && (
                      <div className="fk-field">
                        <span className="fk-label">{t('sceneSheet.usableSegments')}</span>
                        <div className="flex flex-wrap gap-2">
                          {review.usable_segments.map((s, i) => <Pill key={i} state="ok">{s.time_range} · {s.score.toFixed(1)}</Pill>)}
                        </div>
                      </div>
                    )}

                    <div className="fk-field">
                      <span className="fk-label">{t('sceneSheet.fixGuide')}</span>
                      <pre className="fk-code">{review.fix_guide}</pre>
                    </div>
                  </div>
                )}

                {!review && !reviewRunning && <div className="fk-inset border-dashed p-7 text-center text-[12px] text-fg-muted">{t('sceneSheet.noReview')}</div>}
              </div>
            </TabsContent>

            <TabsContent value="stages">
              <div className="pt-4">
                <Accordion type="multiple" defaultValue={[stage]}>
                  {(['image', 'video', 'upscale'] as const).map(sk => {
                    const st = sceneStageStatus(scene, sk)
                    const req = latestOfTypes(requests, STAGE_TYPES[sk])
                    return (
                      <AccordionItem key={sk} value={sk}>
                        <AccordionTrigger>
                          <div className="flex items-center gap-3 w-full">
                            <Dot state={st} />
                            <span>{stageTitleLabel(t, sk)}</span>
                            <span className="text-[11px] ml-auto text-fg-muted">{statusLabel(t, st)}</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="flex flex-col gap-2 pl-5">
                            <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-fg-muted">
                              <span>{t('sceneSheet.stageCreated', { date: fmt(req?.created_at) })}</span>
                              <span>{t('sceneSheet.stageUpdated', { date: fmt(req?.updated_at) })}</span>
                              <span>{t('sceneSheet.stageRetries', { n: req?.retry_count ?? 0 })}</span>
                            </div>
                            {req?.error_message && <pre className="fk-code is-error">{req.error_message}</pre>}
                            {!req && <div className="text-[12px] text-fg-muted">{t('sceneSheet.noRequestYet')}</div>}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    )
                  })}
                </Accordion>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <SheetFooter className="flex-row items-center gap-2 p-3 border-t border-line">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>{t('sceneSheet.close')}</Button>
          <span className="ml-auto" />
          <Button variant="outline" size="sm" disabled={!prompt} onClick={copyPrompt}>{copied ? <Check /> : <Copy />} {copied ? t('sceneSheet.copied') : t('sceneSheet.copyPrompt')}</Button>
          <Button variant="outline" size="sm" disabled={retrying} onClick={onRetry}><RotateCcw className={retrying ? 'animate-spin' : undefined} /> {retrying ? t('sceneSheet.retrying') : t('sceneSheet.retryStage')}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
