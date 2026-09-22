import type { Scene } from '../../types'
import { sceneStageStatus, type SceneStage } from '../../lib/stageStats'

const LANES: SceneStage[] = ['image', 'video', 'upscale']

/** One video as a strip of film: a frame per scene, a lane per stage. */
export default function FilmStrip({ scenes, labels }: { scenes: Scene[]; labels?: Record<SceneStage, string> }) {
  const ordered = scenes.slice().sort((a, b) => a.display_order - b.display_order)
  return (
    <div className="fk-strip-lanes" aria-hidden>
      {LANES.map(lane => {
        const statuses = ordered.map(s => sceneStageStatus(s, lane))
        const full = statuses.length > 0 && statuses.every(s => s === 'COMPLETED')
        return (
          <div key={lane} className="fk-lane" data-full={full} title={labels?.[lane]}>
            {statuses.map((st, i) => <span key={i} className="fk-frame" data-s={st} />)}
          </div>
        )
      })}
    </div>
  )
}
