import { useState, useRef, useEffect } from 'react'
import { Tag as TagIcon, Plus } from 'lucide-react'
import TagBadge, { getTagColorClass } from './TagBadge'

const PRESET_TAGS = ['prod', 'uat', 'dev', 'local']

interface Props {
  tags: string[]
  onChange: (tags: string[]) => void
  editable?: boolean
  compact?: boolean
}

export default function TagSelector({
  tags = [],
  onChange,
  editable = true,
  compact = false
}: Props): JSX.Element {
  const [open, setOpen] = useState(false)
  const [customInput, setCustomInput] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setCustomInput('')
      }
    }
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setOpen(false)
        setCustomInput('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const toggleTag = (t: string): void => {
    const norm = t.trim().toLowerCase()
    if (!norm) return
    if (tags.some((existing) => existing.toLowerCase() === norm)) {
      onChange(tags.filter((existing) => existing.toLowerCase() !== norm))
    } else {
      onChange([...tags, norm])
    }
  }

  const removeTag = (t: string): void => {
    onChange(tags.filter((existing) => existing.toLowerCase() !== t.toLowerCase()))
  }

  const handleAddCustom = (): void => {
    const val = customInput.trim().toLowerCase()
    if (!val) return
    if (!tags.some((t) => t.toLowerCase() === val)) {
      onChange([...tags, val])
    }
    setCustomInput('')
  }

  return (
    <div className={`tag-selector-wrapper ${compact ? 'compact' : ''}`} ref={containerRef}>
      <div className="tag-list">
        {tags.map((t) => (
          <TagBadge
            key={t}
            tag={t}
            size={compact ? 'sm' : 'md'}
            onRemove={editable ? () => removeTag(t) : undefined}
          />
        ))}

        {editable && (
          <button
            type="button"
            className="tag-add-trigger"
            onClick={() => setOpen((prev) => !prev)}
            title="Add or edit tags"
          >
            <TagIcon size={12} className="tag-trigger-icon" />
            <span>{tags.length === 0 ? 'Add Tag' : '+ Tag'}</span>
          </button>
        )}
      </div>

      {open && editable && (
        <div className="tag-popover" onClick={(e) => e.stopPropagation()}>
          <div className="tag-popover-title">Select Environment / Tag</div>

          <div className="tag-presets-grid">
            {PRESET_TAGS.map((preset) => {
              const active = tags.some((t) => t.toLowerCase() === preset)
              const colorClass = getTagColorClass(preset)
              return (
                <button
                  key={preset}
                  type="button"
                  className={`tag-preset-btn ${colorClass} ${active ? 'active' : ''}`}
                  onClick={() => toggleTag(preset)}
                >
                  <TagIcon size={11} />
                  <span>{preset}</span>
                  {active && <span className="tag-preset-check">✓</span>}
                </button>
              )
            })}
          </div>

          <div className="tag-custom-input-row">
            <input
              ref={inputRef}
              type="text"
              placeholder="Custom tag (e.g. canary)..."
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddCustom()
                }
              }}
            />
            <button
              type="button"
              className="tag-custom-add-btn"
              onClick={handleAddCustom}
              disabled={!customInput.trim()}
            >
              <Plus size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
