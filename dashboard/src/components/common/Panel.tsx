import type { CSSProperties, ReactNode } from 'react'

interface PanelProps {
  title?: ReactNode
  sub?: ReactNode
  action?: ReactNode
  children: ReactNode
  flush?: boolean
  className?: string
  style?: CSSProperties
  onClick?: () => void
}

export default function Panel({ title, sub, action, children, flush, className = '', style, onClick }: PanelProps) {
  return (
    <section className={`fk-panel ${onClick ? 'is-interactive' : ''} ${className}`} style={style} onClick={onClick}>
      {(title || action) && (
        <header className="fk-panel-head">
          <div className="min-w-0 flex-1">
            {title && <h2 className="fk-panel-title">{title}</h2>}
            {sub && <p className="fk-panel-sub">{sub}</p>}
          </div>
          {action && <div className="flex-shrink-0 flex items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={`fk-panel-body ${flush ? 'is-flush' : ''}`}>{children}</div>
    </section>
  )
}
