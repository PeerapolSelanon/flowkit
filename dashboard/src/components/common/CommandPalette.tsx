import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, type LucideIcon } from 'lucide-react'
import { fetchAPI } from '../../api/client'
import { useTranslation } from '../../i18n/useTranslation'
import type { Project } from '../../types'

export interface PaletteEntry { id: string; label: string; to: string; icon: LucideIcon; hint?: string; group: 'pages' | 'projects' }

interface Props {
  open: boolean
  onClose: () => void
  pages: PaletteEntry[]
}

export default function CommandPalette({ open, onClose, pages }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(0)
  const [projects, setProjects] = useState<Project[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    fetchAPI<Project[]>('/api/projects').then(ps => setProjects(ps.filter(p => p.status !== 'DELETED'))).catch(() => {})
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [open])

  const items = useMemo<PaletteEntry[]>(() => {
    const projectEntries: PaletteEntry[] = projects.map(p => ({ id: p.id, label: p.name, to: `/projects/${p.id}`, icon: FolderOpen, hint: p.id.slice(0, 8), group: 'projects' }))
    const all = [...pages, ...projectEntries]
    const s = q.trim().toLowerCase()
    return s ? all.filter(i => i.label.toLowerCase().includes(s) || i.hint?.toLowerCase().includes(s)) : all
  }, [pages, projects, q])

  if (!open) return null

  function go(entry: PaletteEntry) { navigate(entry.to); onClose() }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, items.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
    else if (e.key === 'Enter' && items[cursor]) { e.preventDefault(); go(items[cursor]) }
    else if (e.key === 'Escape') onClose()
  }

  const groups: PaletteEntry['group'][] = ['pages', 'projects']

  return (
    <div className="fk-cmd" onClick={onClose} role="dialog" aria-modal="true" aria-label={t('app.searchHint')}>
      <div className="fk-cmd-box" onClick={e => e.stopPropagation()}>
        <input ref={inputRef} className="fk-cmd-input" value={q} onChange={e => { setQ(e.target.value); setCursor(0) }} onKeyDown={onKey} placeholder={t('app.search')} />
        <div className="fk-cmd-list" role="listbox">
          {items.length === 0 && <div className="fk-cmd-group">{t('app.cmd.empty')}</div>}
          {groups.map(g => {
            const list = items.filter(i => i.group === g)
            if (list.length === 0) return null
            return (
              <div key={g}>
                <div className="fk-cmd-group">{g === 'pages' ? t('app.cmd.pages') : t('app.cmd.projects')}</div>
                {list.map(item => {
                  const idx = items.indexOf(item)
                  return (
                    <div key={item.id} className="fk-cmd-item" role="option" aria-selected={idx === cursor} onMouseEnter={() => setCursor(idx)} onClick={() => go(item)}>
                      <item.icon />
                      <span className="truncate">{item.label}</span>
                      {item.hint && <span className="hint">{item.hint}</span>}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
