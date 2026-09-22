import { useState, useRef, useEffect } from 'react'
import { Pencil } from 'lucide-react'
import { useTranslation } from '../../i18n/useTranslation'

interface EditableTextProps {
  value: string
  onSave: (newValue: string) => void
  multiline?: boolean
  className?: string
}

export default function EditableText({ value, onSave, multiline = false, className = '' }: EditableTextProps) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null)

  useEffect(() => { setDraft(value) }, [value])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  function handleSave() {
    setEditing(false)
    if (draft !== value) onSave(draft)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setDraft(value); setEditing(false) }
    else if (e.key === 'Enter' && (!multiline || !e.shiftKey)) handleSave()
  }

  if (!editing) {
    return (
      <button
        type="button"
        className={`group text-left w-full bg-transparent border-0 p-0 font-[inherit] cursor-text whitespace-pre-wrap ${className}`}
        onClick={() => setEditing(true)}
        title={t('editableText.clickToEdit')}
      >
        {value || <span className="text-fg-muted">{t('editableText.empty')}</span>}
        <Pencil size={11} className="inline ml-1.5 align-middle opacity-0 group-hover:opacity-60 transition-opacity" />
      </button>
    )
  }

  if (multiline) {
    return (
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        rows={5}
        className={`fk-textarea resize-y ${className}`}
      />
    )
  }

  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      type="text"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={handleSave}
      onKeyDown={handleKeyDown}
      className={`fk-input ${className}`}
    />
  )
}
