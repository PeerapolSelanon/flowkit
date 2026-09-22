import type { CSSProperties, ReactNode } from 'react'
import { ImageOff, Loader2, AlertTriangle, ImageIcon } from 'lucide-react'
import type { StatusType } from '../../types'

interface ThumbProps {
  src: string | null | undefined
  alt: string
  status?: StatusType
  emptyLabel?: ReactNode
  aspect?: string
  className?: string
  style?: CSSProperties
  children?: ReactNode
}

/** Image with a striped placeholder that says *why* there is no picture. */
export default function Thumb({ src, alt, status = 'PENDING', emptyLabel, aspect, className = '', style, children }: ThumbProps) {
  const Icon = status === 'PROCESSING' ? Loader2 : status === 'FAILED' ? AlertTriangle : src === null ? ImageOff : ImageIcon
  return (
    <div className={`fk-thumb ${className}`} style={{ aspectRatio: aspect, ...style }}>
      {src ? (
        <img src={src} alt={alt} loading="lazy" decoding="async" />
      ) : (
        <div className="fk-thumb-empty" data-s={status}>
          <div className="flex flex-col items-center gap-1.5">
            <Icon size={18} strokeWidth={1.5} className={status === 'PROCESSING' ? 'animate-spin' : undefined} />
            {emptyLabel && <span>{emptyLabel}</span>}
          </div>
        </div>
      )}
      {children}
    </div>
  )
}
