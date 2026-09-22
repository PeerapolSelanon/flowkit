import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FolderOpen, Search } from 'lucide-react'
import { fetchAPI } from '../api/client'
import { useReloadOnEvent } from '../api/useReloadOnEvent'
import type { Project } from '../types'
import ProjectDetailPage from './ProjectDetailPage'
import { useTranslation } from '../i18n/useTranslation'
import type { TranslationKey } from '../i18n/translations'
import { projectStatusLabel } from '../i18n/labels'
import { Skeleton } from '../components/ui/skeleton'
import Thumb from '../components/common/Thumb'
import EmptyState from '../components/common/EmptyState'
import { Bar, Pill } from '../components/common/status'

type FilterTab = 'ACTIVE' | 'ARCHIVED' | 'ALL'
type Progress = { total: number; image: number; video: number; upscale: number }
type T = (key: TranslationKey, params?: Record<string, string | number>) => string

/** Deterministic gradient so a project without a cover still has a face. */
function coverFallback(name: string): string {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const a = h % 360, b = (a + 40) % 360
  return `linear-gradient(135deg, hsl(${a} 40% 22%), hsl(${b} 45% 12%))`
}

function ProjectCard({ project, progress, onClick, t, lang }: { project: Project; progress?: Progress; onClick: () => void; t: T; lang: string }) {
  const total = progress?.total ?? 0
  const stages = (['image', 'video', 'upscale'] as const)
  const tier = project.user_paygate_tier?.includes('TWO') ? t('projects.tier2') : project.user_paygate_tier ? t('projects.tier1') : null
  return (
    <article className="fk-panel is-interactive fk-project" onClick={onClick} role="link" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onClick()}>
      <Thumb src={project.thumbnail_url} alt="" style={project.thumbnail_url ? undefined : { background: coverFallback(project.name) }}>
        {!project.thumbnail_url && <div className="absolute inset-0 grid place-items-center"><FolderOpen size={26} strokeWidth={1.2} className="text-fg/40" /></div>}
        <div className="fk-thumb-shade" />
        <div className="absolute left-3 top-3 flex gap-1.5">
          <Pill state={project.status === 'ACTIVE' ? 'ok' : 'outline'}>{projectStatusLabel(t, project.status)}</Pill>
          {tier && <Pill state="brand">{tier}</Pill>}
        </div>
        {project.material && <span className="fk-corner right-3 bottom-3">{project.material}</span>}
      </Thumb>
      <div className="fk-project-body">
        <div className="flex flex-col gap-1">
          <h3 className="fk-project-title">{project.name}</h3>
          {project.description && <p className="fk-project-desc">{project.description}</p>}
        </div>
        {total > 0 && progress && (
          <div className="fk-tracks">
            {stages.map(k => (
              <div key={k} className="fk-track">
                <span>{t(`common.stageTitle.${k}` as TranslationKey)}</span>
                <Bar done={progress[k]} total={total} />
                <span style={{ color: progress[k] === total ? 'var(--ok)' : undefined }}>{progress[k]}/{total}</span>
              </div>
            ))}
          </div>
        )}
        <div className="fk-project-foot">
          <span>{new Date(project.created_at).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          <span className="font-mono text-[10px] ml-auto">{project.id.slice(0, 8)}</span>
        </div>
      </div>
    </article>
  )
}

export default function ProjectsPage() {
  const { t, lang } = useTranslation()
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<FilterTab>('ACTIVE')
  const [query, setQuery] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [progress, setProgress] = useState<Record<string, Progress>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAPI<Project[]>('/api/projects').then(setProjects).catch(console.error).finally(() => setLoading(false))
  }, [])

  const loadProgress = useCallback(() => fetchAPI<Record<string, Progress>>('/api/projects/progress').then(setProgress).catch(console.error), [])
  useEffect(() => { loadProgress() }, [loadProgress])
  useReloadOnEvent(loadProgress)

  if (id) return <ProjectDetailPage projectId={id} onBack={() => navigate('/projects')} />

  const q = query.trim().toLowerCase()
  const filtered = projects
    .filter(p => (tab === 'ALL' ? p.status !== 'DELETED' : p.status === tab))
    .filter(p => !q || p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q) || p.id.startsWith(q))
    .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))

  const counts = { ACTIVE: projects.filter(p => p.status === 'ACTIVE').length, ARCHIVED: projects.filter(p => p.status === 'ARCHIVED').length, ALL: projects.filter(p => p.status !== 'DELETED').length }

  return (
    <div className="fk-page fk-fade">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="fk-title">{t('projects.title')}</h1>
          <p className="fk-lede">{t('projects.lede')}</p>
        </div>
        <span className="text-[12px] text-fg-muted">{t('projects.count', { n: filtered.length })}</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="fk-seg" role="tablist">
          {(['ACTIVE', 'ARCHIVED', 'ALL'] as FilterTab[]).map(k => (
            <button key={k} role="tab" aria-pressed={tab === k} onClick={() => setTab(k)}>
              {t(`projects.tab.${k.toLowerCase()}` as TranslationKey)} <span className="text-fg-muted tabular-nums ml-1">{counts[k]}</span>
            </button>
          ))}
        </div>
        <label className="fk-search w-full sm:w-72">
          <Search />
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('projects.search')} className="fk-input" />
        </label>
      </div>

      {loading ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-[280px] rounded-[14px]" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="fk-panel"><EmptyState icon={FolderOpen} title={t(`projects.empty.${tab}` as TranslationKey)} hint={q ? t('projects.emptyHint') : undefined} /></div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {filtered.map(p => <ProjectCard key={p.id} project={p} progress={progress[p.id]} onClick={() => navigate(`/projects/${p.id}`)} t={t} lang={lang} />)}
        </div>
      )}
    </div>
  )
}
