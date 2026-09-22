import { Link2, CornerDownRight, RotateCcw, Clock } from 'lucide-react'
import type { Scene } from '../../types'
import { useTranslation } from '../../i18n/useTranslation'
import { statusLabel, stageTitleLabel, chainLabel } from '../../i18n/labels'
import { sceneStageStatus, type SceneStage } from '../../lib/stageStats'
import Thumb from '../common/Thumb'
import { Dot } from '../common/status'

interface SceneCardProps {
  scene: Scene
  stage: SceneStage
  retries: number
  verdict?: string
  onClick: () => void
}

const VERDICT_TONE: Record<string, string> = {
  excellent: 'var(--ok)', good: 'var(--ok)', acceptable: 'var(--busy)', poor: 'var(--fail)', unusable: 'var(--fail)',
}

export default function SceneCard({ scene, stage, retries, verdict, onClick }: SceneCardProps) {
  const { t } = useTranslation()
  const status = sceneStageStatus(scene, stage)
  const thumbUrl = scene.vertical_image_url || scene.horizontal_image_url
  const prompt = stage === 'video' ? scene.video_prompt : (scene.image_prompt ?? scene.prompt)
  const ChainIcon = scene.chain_type === 'CONTINUATION' ? Link2 : scene.chain_type === 'INSERT' ? CornerDownRight : null

  return (
    <button type="button" onClick={onClick} className="fk-scene" data-s={status}>
      <Thumb
        src={thumbUrl}
        alt={t('sceneCard.scene', { n: scene.display_order + 1 })}
        status={status}
        emptyLabel={status === 'PENDING' ? t('sceneCard.notGenerated') : status === 'FAILED' ? t('sceneCard.noOutput') : status === 'PROCESSING' ? t('common.status.processing') : t('sceneCard.noPreview')}
      >
        <div className="fk-thumb-shade" />
        <span className="fk-corner left-2.5 top-2.5 font-medium">#{scene.display_order + 1}</span>
        <span className="fk-corner right-2.5 top-2.5"><Dot state={status} />{statusLabel(t, status)}</span>
        <span className="absolute left-2.5 bottom-2.5 flex items-center gap-2 text-[11px] text-fg-2">
          <span className="flex items-center gap-1"><Clock size={11} />{scene.duration ? `${scene.duration}s` : t('sceneCard.still')}</span>
          {ChainIcon && <span className="flex items-center gap-1"><ChainIcon size={11} />{chainLabel(t, scene.chain_type)}</span>}
        </span>
      </Thumb>
      <div className="fk-scene-body">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-medium">{stageTitleLabel(t, stage)}</span>
          {verdict && <span className="text-[11px] font-medium" style={{ color: VERDICT_TONE[verdict] ?? 'var(--fg-2)' }}>{verdict}</span>}
        </div>
        {prompt && <p className="fk-scene-prompt">{prompt}</p>}
        <div className="fk-scene-meta">
          {retries > 0 && <span className="flex items-center gap-1" style={{ color: 'var(--busy)' }}><RotateCcw size={11} />{t('sceneCard.retries', { n: retries })}</span>}
          <span className="ml-auto font-mono text-[10px]">{scene.id.slice(0, 8)}</span>
        </div>
      </div>
    </button>
  )
}
