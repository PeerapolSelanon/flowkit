import { useState, useRef } from 'react'
import { Film, Play } from 'lucide-react'
import type { Scene } from '../../types'
import VideoPlayer from './VideoPlayer'
import { useTranslation } from '../../i18n/useTranslation'
import EmptyState from '../common/EmptyState'
import { Pill } from '../common/status'

type GalleryScene = Scene & { videoTitle?: string }

function Tile({ scene, onOpen }: { scene: GalleryScene; onOpen: () => void }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLVideoElement>(null)
  const [hover, setHover] = useState(false)
  const src = scene.vertical_upscale_url || scene.vertical_video_url || ''

  function enter() { setHover(true); const v = ref.current; if (v) { v.currentTime = 0; v.play().catch(() => {}) } }
  function leave() { setHover(false); ref.current?.pause() }

  return (
    <div className="fk-tile" onMouseEnter={enter} onMouseLeave={leave} onFocus={enter} onBlur={leave} onClick={onOpen} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onOpen()}>
      {scene.vertical_image_url ? (
        <img src={scene.vertical_image_url} alt={t('gallery.sceneAlt', { n: scene.display_order + 1 })} loading="lazy" decoding="async" />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-fg-muted text-[11px] bg-surface">{t('gallery.noImage')}</div>
      )}
      {hover && <video ref={ref} src={src} muted playsInline loop preload="none" style={{ opacity: 1 }} />}
      <div className="fk-thumb-shade" />
      <span className="fk-corner left-2.5 top-2.5 font-medium">#{scene.display_order + 1}</span>
      <span className="absolute right-2.5 top-2.5"><Pill state={scene.vertical_upscale_url ? 'brand' : 'outline'}>{scene.vertical_upscale_url ? t('gallery.badgeUpscaled') : t('gallery.badgeVideo')}</Pill></span>
      {!hover && (
        <span className="absolute inset-0 grid place-items-center pointer-events-none">
          <span className="w-11 h-11 rounded-full grid place-items-center" style={{ background: 'rgba(6,7,10,.55)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,.15)' }}><Play size={16} className="ml-0.5" /></span>
        </span>
      )}
      <div className="fk-tile-cap">
        {scene.videoTitle && <span>{scene.videoTitle}</span>}
        <b className="truncate">{scene.prompt?.slice(0, 70) ?? ''}</b>
      </div>
    </div>
  )
}

export default function VideoGallery({ scenes }: { scenes: GalleryScene[] }) {
  const { t } = useTranslation()
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const playable = scenes.filter(s => s.vertical_video_url)

  if (playable.length === 0) {
    return <div className="fk-panel"><EmptyState icon={Film} title={t('gallery.empty')} hint={t('gallery.emptyHint')} /></div>
  }

  return (
    <>
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {playable.map((scene, idx) => <Tile key={scene.id} scene={scene} onOpen={() => setActiveIndex(idx)} />)}
      </div>
      {activeIndex !== null && <VideoPlayer scenes={playable} initialIndex={activeIndex} onClose={() => setActiveIndex(null)} />}
    </>
  )
}
