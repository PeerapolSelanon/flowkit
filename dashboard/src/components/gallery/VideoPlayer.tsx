import { useState, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import type { Scene } from '../../types'
import { useTranslation } from '../../i18n/useTranslation'
import { chainLabel } from '../../i18n/labels'
import { Button } from '../ui/button'
import { Pill } from '../common/status'

type GalleryScene = Scene & { videoTitle?: string }

interface VideoPlayerProps { scenes: GalleryScene[]; initialIndex: number; onClose: () => void }

function parseCharacterNames(raw: string | null): string[] {
  if (!raw) return []
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p : [] } catch { return [] }
}

export default function VideoPlayer({ scenes, initialIndex, onClose }: VideoPlayerProps) {
  const { t } = useTranslation()
  const [index, setIndex] = useState(initialIndex)
  const scene = scenes[index]
  const videoSrc = scene.vertical_upscale_url || scene.vertical_video_url || ''
  const charNames = parseCharacterNames(scene.character_names)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && index > 0) setIndex(i => i - 1)
      if (e.key === 'ArrowRight' && index < scenes.length - 1) setIndex(i => i + 1)
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [index, scenes.length, onClose])

  return (
    <div className="fk-lightbox fk-fade" onClick={onClose} role="dialog" aria-modal="true">
      <div className="fk-lightbox-box" onClick={e => e.stopPropagation()}>
        <div className="fk-lightbox-stage relative">
          <video key={videoSrc} src={videoSrc} controls autoPlay playsInline />
          <Button variant="outline" size="icon-sm" className="absolute left-3 top-3 md:hidden" onClick={onClose} aria-label={t('common.close')}><X /></Button>
        </div>

        <div className="fk-lightbox-side">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-[11px] text-fg-muted truncate">{scene.videoTitle}</span>
              <h3 className="m-0 text-[16px] font-semibold">{t('videoPlayer.sceneLabel', { n: scene.display_order + 1 })}</h3>
              <div className="flex flex-wrap gap-1.5 mt-1">
                <Pill state="brand">{chainLabel(t, scene.chain_type)}</Pill>
                <Pill state={scene.vertical_upscale_url ? 'ok' : 'outline'}>{scene.vertical_upscale_url ? t('gallery.badgeUpscaled') : t('gallery.badgeVideo')}</Pill>
                {scene.duration && <Pill state="outline">{scene.duration}s</Pill>}
              </div>
            </div>
            <Button variant="ghost" size="icon-sm" className="hidden md:inline-flex" onClick={onClose} aria-label={t('common.close')}><X /></Button>
          </div>

          {scene.prompt && (
            <div className="fk-field">
              <span className="fk-label">{t('videoPlayer.prompt')}</span>
              <p className="m-0 text-[12.5px] leading-relaxed">{scene.prompt}</p>
            </div>
          )}
          {scene.video_prompt && (
            <div className="fk-field">
              <span className="fk-label">{t('videoPlayer.videoPrompt')}</span>
              <pre className="fk-code">{scene.video_prompt}</pre>
            </div>
          )}
          {scene.narrator_text && (
            <div className="fk-field">
              <span className="fk-label">{t('sceneSheet.narration')}</span>
              <p className="m-0 text-[12.5px] leading-relaxed text-fg-2">{scene.narrator_text}</p>
            </div>
          )}
          {charNames.length > 0 && (
            <div className="fk-field">
              <span className="fk-label">{t('videoPlayer.characters')}</span>
              <div className="flex flex-wrap gap-1.5">{charNames.map(name => <Pill key={name} state="outline">{name}</Pill>)}</div>
            </div>
          )}

          <div className="mt-auto flex flex-col gap-2 pt-2">
            <Button asChild><a href={videoSrc} download={`scene-${scene.display_order + 1}.mp4`}><Download /> {t('videoPlayer.download')}</a></Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" disabled={index === 0} onClick={() => setIndex(i => i - 1)}><ChevronLeft /> {t('videoPlayer.prev')}</Button>
              <Button variant="outline" disabled={index === scenes.length - 1} onClick={() => setIndex(i => i + 1)}>{t('videoPlayer.next')} <ChevronRight /></Button>
            </div>
            <span className="text-center text-[11px] text-fg-muted tabular-nums">{index + 1} / {scenes.length}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
