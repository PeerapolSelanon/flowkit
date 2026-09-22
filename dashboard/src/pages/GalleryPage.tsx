import { useState, useEffect, useCallback, useMemo } from 'react'
import { Film } from 'lucide-react'
import { fetchAPI } from '../api/client'
import type { Project, Video, Scene } from '../types'
import VideoGallery from '../components/gallery/VideoGallery'
import { useTranslation } from '../i18n/useTranslation'
import { Skeleton } from '../components/ui/skeleton'
import EmptyState from '../components/common/EmptyState'

type Filter = 'all' | 'upscaled'

export default function GalleryPage() {
  const { t } = useTranslation()
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [selectedVideo, setSelectedVideo] = useState<string>('all')
  const [filter, setFilter] = useState<Filter>('all')
  const [videos, setVideos] = useState<Video[]>([])
  const [scenes, setScenes] = useState<(Scene & { videoTitle: string })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAPI<Project[]>('/api/projects')
      .then(ps => {
        const live = ps.filter(p => p.status !== 'DELETED')
        setProjects(live)
        if (live.length > 0) setSelectedProject(live[0].id); else setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const loadProjectMedia = useCallback(async (projectId: string) => {
    setLoading(true)
    const vids = await fetchAPI<Video[]>(`/api/videos?project_id=${projectId}`)
    setVideos(vids)
    const sceneLists = await Promise.all(vids.map(v => fetchAPI<Scene[]>(`/api/scenes?video_id=${v.id}`)))
    setScenes(vids.flatMap((v, i) => sceneLists[i].map(s => ({ ...s, videoTitle: v.title }))))
    setSelectedVideo('all')
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!selectedProject) return
    Promise.resolve().then(() => loadProjectMedia(selectedProject).catch(() => setLoading(false)))
  }, [selectedProject, loadProjectMedia])

  const visible = useMemo(() => scenes
    .filter(s => selectedVideo === 'all' || s.video_id === selectedVideo)
    .filter(s => filter === 'all' || s.vertical_upscale_url), [scenes, selectedVideo, filter])
  const playable = visible.filter(s => s.vertical_video_url).length

  return (
    <div className="fk-page fk-fade">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="fk-title">{t('gallery.title')}</h1>
          <p className="fk-lede">{t('gallery.lede')}</p>
        </div>
        <span className="text-[12px] text-fg-muted">{t('gallery.count', { videos: videos.length, scenes: playable })}</span>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="fk-field w-full sm:w-64">
          <span className="fk-label">{t('gallery.projectLabel')}</span>
          <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} className="fk-select">
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="fk-field w-full sm:w-56">
          <span className="fk-label">{t('gallery.videoLabel')}</span>
          <select value={selectedVideo} onChange={e => setSelectedVideo(e.target.value)} className="fk-select">
            <option value="all">{t('gallery.allVideos')}</option>
            {videos.map(v => <option key={v.id} value={v.id}>{v.title}</option>)}
          </select>
        </label>
        <div className="fk-seg">
          <button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>{t('gallery.filter.all')}</button>
          <button aria-pressed={filter === 'upscaled'} onClick={() => setFilter('upscaled')}>{t('gallery.filter.upscaled')}</button>
        </div>
        <span className="text-[11px] text-fg-muted sm:ml-auto">{t('gallery.hoverHint')}</span>
      </div>

      {loading ? (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="rounded-[12px]" style={{ aspectRatio: '9/16' }} />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="fk-panel"><EmptyState icon={Film} title={t('projects.empty.ALL')} /></div>
      ) : (
        <VideoGallery scenes={visible} />
      )}
    </div>
  )
}
