import { useState, useRef, useEffect } from 'react'
import { Tag as TagIcon, Plus } from 'lucide-react'
import TagBadge from './TagBadge'

const PRESET_TAGS = ['prod', 'uat', 'dev', 'local']

interface Props {
  tags?: string[]
  onChange: (tags: string[]) => void
  editable?: boolean
  compact?: boolean
  align?: 'left' | 'right'
}

export default function TagSelector({
  tags = [],
  onChange,
  editable = true,
  compact = false,
  align
}: Props): JSX.Element {
  const [open, setOpen] = useState(false)
  const [customInput, setCustomInput] = useState('')
  const [effectiveAlign, setEffectiveAlign] = useState<'left' | 'right'>(align || 'left')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const currentTag = tags && tags.length > 0 ? tags[0] : ''

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
      if (align) {
        setEffectiveAlign(align)
      } else if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        if (window.innerWidth - rect.left < 240 || rect.right > window.innerWidth - 60) {
          setEffectiveAlign('right')
        } else {
          setEffectiveAlign('left')
        }
      }
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open, align])

  const selectPreset = (preset: string): void => {
    const norm = preset.trim().toLowerCase()
    if (currentTag.toLowerCase() === norm) {
      onChange([])
    } else {
      onChange([norm])
    }
    setOpen(false)
  }

  const handleAddCustom = (): void => {
    const val = customInput.trim().toLowerCase()
    if (!val) return
    onChange([val])
    setCustomInput('')
    setOpen(false)
  }

  const handleClear = (): void => {
    onChange([])
    setOpen(false)
  }

  return (
    <div className={`tag-selector-wrapper ${compact ? 'compact' : ''}`} ref={containerRef}>
      <div className="tag-list">
        {currentTag ? (
          <TagBadge
            tag={currentTag}
            size={compact ? 'sm' : 'md'}
            onClick={editable ? () => setOpen((prev) => !prev) : undefined}
            onRemove={editable ? handleClear : undefined}
          />
        ) : (
          editable && (
            <button
              type="button"
              className="tag-add-trigger"
              onClick={() => setOpen((prev) => !prev)}
              title="Add tag"
            >
              <TagIcon size={12} className="tag-trigger-icon" />
              <span>Add Tag</span>
            </button>
          )
        )}
      </div>

      {open && editable && (
        <div
          className={`tag-popover ${effectiveAlign === 'right' ? 'align-right' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="tag-popover-title">Select Environment / Tag</div>

          <div className="tag-presets-grid">
            {PRESET_TAGS.map((preset) => {
              const active = currentTag.toLowerCase() === preset.toLowerCase()
              return (
                <button
                  key={preset}
                  type="button"
                  className={`tag-preset-btn ${active ? 'active' : ''}`}
                  onClick={() => selectPreset(preset)}
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
              title="Set custom tag"
            >
              <Plus size={13} />
            </button>
          </div>

          {currentTag && (
            <button type="button" className="tag-clear-btn" onClick={handleClear}>
              Clear Tag
            </button>
          )}
        </div>
      )}
    </div>
  )
}
