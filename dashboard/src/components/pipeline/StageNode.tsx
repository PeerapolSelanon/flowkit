import { useTranslation } from '../../i18n/useTranslation'
import { Bar } from '../common/status'

export type StageKey = 'refs' | 'image' | 'video' | 'upscale'

interface StageNodeProps {
  idx: string
  name: string
  subtitle: string
  done: number
  processing: number
  failed: number
  pending: number
  total: number
  isActive: boolean
  onClick: () => void
}

export default function StageNode({ idx, name, subtitle, done, processing, failed, pending, total, isActive, onClick }: StageNodeProps) {
  const { t } = useTranslation()
  return (
    <button type="button" onClick={onClick} className="fk-stage" aria-pressed={isActive}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col min-w-0">
          <span className="fk-stage-num">{idx}</span>
          <span className="fk-stage-name">{name}</span>
          <span className="fk-stage-sub">{subtitle}</span>
        </div>
        <span className="fk-stage-count whitespace-nowrap">{done}<small>/ {total}</small></span>
      </div>
      <Bar done={done} busy={processing} fail={failed} total={total} />
      <div className="fk-stage-legend">
        <span><i style={{ background: 'var(--ok)' }} />{done} {t('stageNode.done')}</span>
        <span><i style={{ background: 'var(--busy)' }} />{processing} {t('stageNode.proc')}</span>
        <span><i style={{ background: 'var(--fail)' }} />{failed} {t('stageNode.fail')}</span>
        <span><i style={{ background: 'var(--idle)' }} />{pending} {t('stageNode.pend')}</span>
      </div>
    </button>
  )
}
