import { useState, useEffect, useCallback } from 'react'
import { BrowserRouter, NavLink, Routes, Route, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { LayoutDashboard, FolderOpen, Film, ScrollText, BookOpen, SlidersHorizontal, Menu, PanelLeftClose, PanelLeftOpen, Search, X, Languages } from 'lucide-react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { WebSocketProvider } from './api/WebSocketContext'
import { useWebSocketContext } from './api/useWebSocketContext'
import { SystemHealthProvider } from './api/SystemHealthProvider'
import { useSystemHealth } from './api/systemHealth'
import { LanguageProvider } from './i18n/LanguageContext'
import { useTranslation } from './i18n/useTranslation'
import { LANGS, LANG_LABELS, type Lang } from './i18n/translations'
import type { TranslationKey } from './i18n/translations'
import { fetchAPI } from './api/client'
import type { Project } from './types'
import { Dot } from './components/common/status'
import CommandPalette, { type PaletteEntry } from './components/common/CommandPalette'
import DashboardPage from './pages/DashboardPage'
import ProjectsPage from './pages/ProjectsPage'
import LogsPage from './pages/LogsPage'
import GalleryPage from './pages/GalleryPage'
import GuidePage from './pages/GuidePage'
import SettingsPage from './pages/SettingsPage'

const NAV: { to: string; icon: typeof LayoutDashboard; labelKey: TranslationKey; exact: boolean }[] = [
  { to: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard', exact: true },
  { to: '/projects', icon: FolderOpen, labelKey: 'nav.projects', exact: false },
  { to: '/gallery', icon: Film, labelKey: 'nav.gallery', exact: false },
  { to: '/logs', icon: ScrollText, labelKey: 'nav.logs', exact: false },
  { to: '/guide', icon: BookOpen, labelKey: 'nav.guide', exact: false },
  { to: '/settings', icon: SlidersHorizontal, labelKey: 'nav.settings', exact: false },
]

const BREADCRUMB_TAB_KEY: Record<string, TranslationKey> = {
  overview: 'app.breadcrumbTab.overview',
  characters: 'app.breadcrumbTab.characters',
  videos: 'app.breadcrumbTab.videos',
  pipeline: 'app.breadcrumbTab.pipeline',
}

const COLLAPSE_KEY = 'fk-sidebar-collapsed'

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

function useBreadcrumbs() {
  const { t } = useTranslation()
  const loc = useLocation()
  const { id } = useParams<{ id?: string }>()
  const [searchParams] = useSearchParams()
  const [projectName, setProjectName] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    fetchAPI<Project>(`/api/projects/${id}`).then(p => setProjectName(p.name)).catch(() => setProjectName(null))
  }, [id])

  const crumbs: string[] = []
  if (loc.pathname === '/') crumbs.push(t('app.breadcrumb.dashboard'))
  else if (loc.pathname.startsWith('/projects')) {
    crumbs.push(t('app.breadcrumb.projects'))
    if (id) {
      crumbs.push(projectName ?? '…')
      const tab = searchParams.get('tab')
      const tabKey = tab ? BREADCRUMB_TAB_KEY[tab] : undefined
      if (tabKey) crumbs.push(t(tabKey))
    }
  } else if (loc.pathname.startsWith('/gallery')) crumbs.push(t('app.breadcrumb.gallery'))
  else if (loc.pathname.startsWith('/logs')) crumbs.push(t('app.breadcrumb.logs'))
  else if (loc.pathname.startsWith('/guide')) crumbs.push(t('app.breadcrumb.guide'))
  else if (loc.pathname.startsWith('/settings')) crumbs.push(t('app.breadcrumb.settings'))
  return crumbs
}

function LanguageSwitcher({ compact }: { compact: boolean }) {
  const { lang, setLang, t } = useTranslation()
  return (
    <label className="fk-field" title={t('app.language')}>
      <span className="sr-only">{t('app.language')}</span>
      <span className="relative flex items-center">
        <Languages size={13} className="absolute left-2.5 text-fg-muted pointer-events-none" />
        <select
          value={lang}
          onChange={e => setLang(e.target.value as Lang)}
          className="fk-select text-xs"
          style={{ paddingLeft: compact ? 8 : 28, paddingTop: 5, paddingBottom: 5 }}
          aria-label={t('app.language')}
        >
          {LANGS.map(l => <option key={l} value={l}>{compact ? l.toUpperCase() : LANG_LABELS[l]}</option>)}
        </select>
      </span>
    </label>
  )
}

function SidebarBody({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { t } = useTranslation()
  const { worker } = useWebSocketContext()
  const health = useSystemHealth()
  const slots = worker ? worker.active + worker.slots : 0
  const load = slots > 0 ? Math.round((worker!.active / slots) * 100) : 0

  return (
    <>
      <div className="fk-side-brand">
        <span className="fk-mark" aria-hidden>F</span>
        {!collapsed && (
          <div className="flex flex-col leading-tight fk-side-text min-w-0">
            <span className="text-[13px] font-semibold tracking-tight">{t('app.brandName')}</span>
            <span className="text-[11px] text-fg-muted truncate">{t('app.brandTag')}</span>
          </div>
        )}
      </div>

      <nav className="fk-nav" aria-label="Main">
        {NAV.map(({ to, icon: Icon, labelKey, exact }) => (
          <NavLink key={to} to={to} end={exact} className="fk-nav-item" title={collapsed ? t(labelKey) : undefined} onClick={onNavigate}>
            <Icon />
            <span className="fk-nav-label">{t(labelKey)}</span>
          </NavLink>
        ))}
      </nav>

      <div className="fk-side-foot">
        {!collapsed && (
          <>
            <LanguageSwitcher compact={false} />
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[11px] text-fg-muted">
                <span>{t('app.workerLoad')}</span>
                <span className="text-fg tabular-nums">{worker ? `${worker.active}/${slots}` : '—'}</span>
              </div>
              <div className="fk-meter"><i style={{ width: `${load}%` }} /></div>
            </div>
          </>
        )}
        <div className={`flex items-center gap-2 text-[11px] text-fg-muted ${collapsed ? 'justify-center' : ''}`} title={t(health.extension === 'ok' ? 'app.extensionConnected' : health.extension === 'down' ? 'app.extensionDisconnected' : 'app.extensionChecking')}>
          <Dot state={health.extension} />
          {!collapsed && <span className="truncate">{health.extension === 'ok' ? t('app.extensionConnected') : health.extension === 'down' ? t('app.extensionDisconnected') : t('app.extensionChecking')}</span>}
        </div>
      </div>
    </>
  )
}

function Header({ onMenu, onSearch, collapsed, onToggleCollapse }: { onMenu: () => void; onSearch: () => void; collapsed: boolean; onToggleCollapse: () => void }) {
  const { t } = useTranslation()
  const { isConnected } = useWebSocketContext()
  const crumbs = useBreadcrumbs()
  const clock = useClock()
  const tc = clock.toTimeString().slice(0, 8)

  return (
    <header className="fk-top">
      <button className="fk-nav-item !p-2 md:hidden" onClick={onMenu} aria-label={t('app.menu')}><Menu /></button>
      <button className="fk-nav-item !p-2 hidden md:inline-flex" onClick={onToggleCollapse} aria-label={collapsed ? t('app.expand') : t('app.collapse')}>
        {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
      </button>
      <nav className="fk-crumbs" aria-label="Breadcrumb">
        <span className="!text-brand hidden sm:inline">{t('app.breadcrumbRoot')}</span>
        {crumbs.map((c, i) => (
          <span key={i} className="contents">
            <i className={i === 0 ? 'hidden sm:inline' : ''}>/</i>
            <span>{c}</span>
          </span>
        ))}
      </nav>
      <span className="ml-auto" />
      <button className="fk-nav-item !py-1.5 !px-2.5 gap-2 text-fg-muted" onClick={onSearch} aria-label={t('app.searchHint')}>
        <Search />
        <span className="fk-kbd hidden md:inline">Ctrl K</span>
      </button>
      <span className="fk-timecode hidden sm:inline-block" aria-label="clock">{tc}</span>
      <span className="fk-pill" data-s={isConnected ? 'ok' : 'down'} title={isConnected ? t('app.wsLive') : t('app.wsDisconnected')}>
        <span className="fk-dot" data-s={isConnected ? 'ok' : 'down'} />
        <span className="hidden sm:inline">{isConnected ? t('app.wsLive') : t('app.wsDisconnected')}</span>
      </span>
    </header>
  )
}

function Layout() {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(COLLAPSE_KEY) === '1' } catch { return false } })
  const [drawer, setDrawer] = useState(false)
  const [palette, setPalette] = useState(false)
  const toggleCollapse = useCallback(() => {
    setCollapsed(c => { try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1') } catch { /* no storage */ } return !c })
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(p => !p) }
      if (e.key === 'Escape') { setPalette(false); setDrawer(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const pages: PaletteEntry[] = NAV.map(n => ({ id: n.to, label: t(n.labelKey), to: n.to, icon: n.icon, group: 'pages' }))

  return (
    <div className="fk-shell" data-collapsed={collapsed}>
      <aside className="fk-side hidden md:flex">
        <SidebarBody collapsed={collapsed} />
      </aside>

      {drawer && (
        <div className="fk-drawer md:hidden">
          <div className="fk-drawer-bg" onClick={() => setDrawer(false)} />
          <div className="fk-drawer-panel">
            <button className="fk-nav-item !p-2 absolute right-2 top-3" onClick={() => setDrawer(false)} aria-label={t('common.close')}><X /></button>
            <SidebarBody collapsed={false} onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      )}

      <div className="flex flex-col min-h-0 min-w-0">
        <Header onMenu={() => setDrawer(true)} onSearch={() => setPalette(true)} collapsed={collapsed} onToggleCollapse={toggleCollapse} />
        <main className="fk-main">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:id" element={<ProjectsPage />} />
            <Route path="/gallery" element={<GalleryPage />} />
            <Route path="/logs" element={<LogsPage />} />
            <Route path="/guide" element={<GuidePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>

      {palette && <CommandPalette open onClose={() => setPalette(false)} pages={pages} />}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <WebSocketProvider>
          <SystemHealthProvider>
            <TooltipProvider>
              <Layout />
            </TooltipProvider>
          </SystemHealthProvider>
        </WebSocketProvider>
      </LanguageProvider>
    </BrowserRouter>
  )
}
