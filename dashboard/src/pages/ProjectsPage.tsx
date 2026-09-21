import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchAPI } from '../api/client'
import { useReloadOnEvent } from '../api/useReloadOnEvent'
import type { Project } from '../types'
import ProjectDetailPage from './ProjectDetailPage'
import { useTranslation } from '../i18n/useTranslation'
import type { TranslationKey } from '../i18n/translations'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction, CardFooter } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'

type FilterTab = 'ACTIVE' | 'ARCHIVED' | 'ALL'
type Progress = { total: number; image: number; video: number; upscale: number }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString()
}

function TierBadge({ tier, t }: { tier: string | null; t: (key: TranslationKey) => string }) {
  if (!tier) return null
  const isTwo = tier.includes('TWO')
  return <Badge variant={isTwo ? 'default' : 'secondary'}>{isTwo ? t('projects.tier2') : t('projects.tier1')}</Badge>
}

function ProjectCard({ project, progress, onClick, t }: { project: Project; progress?: Progress; onClick: () => void; t: (key: TranslationKey, params?: Record<string, string | number>) => string }) {
  return (
    <Card className="py-4 gap-3 h-full cursor-pointer transition-opacity hover:opacity-90" onClick={onClick}>
      <CardHeader>
        <CardTitle className="text-sm">{project.name}</CardTitle>
        {project.description && (
          <CardDescription className="text-[11px] leading-relaxed line-clamp-2">{project.description}</CardDescription>
        )}
        <CardAction>
          <TierBadge tier={project.user_paygate_tier} t={t} />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1.5">
          {project.material && <Badge variant="outline">{project.material}</Badge>}
          <Badge variant="outline">{project.status}</Badge>
        </div>
        {progress && progress.total > 0 && (
          <div className="mt-2 text-[10px]" style={{ color: 'var(--muted)' }}>
            {(['image', 'video', 'upscale'] as const).map((k, i) => (
              <span key={k} style={{ color: progress[k] === progress.total ? 'var(--green)' : undefined }}>
                {i > 0 && <span style={{ color: 'var(--muted)' }}> · </span>}
                {t(`projects.progress.${k}` as TranslationKey)} {progress[k]}/{progress.total}
              </span>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <span className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>{t('projects.footer', { date: formatDate(project.created_at), id: project.id.slice(0, 8) })}</span>
      </CardFooter>
    </Card>
  )
}

export default function ProjectsPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<FilterTab>('ACTIVE')
  const [query, setQuery] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [progress, setProgress] = useState<Record<string, Progress>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAPI<Project[]>('/api/projects')
      .then(setProjects)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const loadProgress = useCallback(() => fetchAPI<Record<string, Progress>>('/api/projects/progress').then(setProgress).catch(console.error), [])
  useEffect(() => { loadProgress() }, [loadProgress])
  useReloadOnEvent(loadProgress)

  // If there's an :id param, show detail page
  if (id) {
    return <ProjectDetailPage projectId={id} onBack={() => navigate('/projects')} />
  }

  const q = query.trim().toLowerCase()
  const filtered = projects
    .filter(p => (tab === 'ALL' ? p.status !== 'DELETED' : p.status === tab))
    .filter(p => !q || p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q) || p.id.startsWith(q))
    .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Tabs value={tab} onValueChange={v => setTab(v as FilterTab)}>
          <TabsList>
            <TabsTrigger value="ACTIVE">{t('projects.tab.active')}</TabsTrigger>
            <TabsTrigger value="ARCHIVED">{t('projects.tab.archived')}</TabsTrigger>
            <TabsTrigger value="ALL">{t('projects.tab.all')}</TabsTrigger>
          </TabsList>
        </Tabs>
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('projects.search')}
          className="px-2.5 py-1.5 rounded border text-xs outline-none w-64"
          style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }}
        />
        <span className="ml-auto text-[11px]" style={{ color: 'var(--muted)' }}>{t('projects.count', { n: filtered.length })}</span>
      </div>

      {loading ? (
        <div className="text-xs" style={{ color: 'var(--muted)' }}>{t('projects.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="text-xs" style={{ color: 'var(--muted)' }}>{t(`projects.empty.${tab}` as TranslationKey)}</div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {filtered.map(p => (
            <ProjectCard key={p.id} project={p} progress={progress[p.id]} onClick={() => navigate(`/projects/${p.id}`)} t={t} />
          ))}
        </div>
      )}
    </div>
  )
}
