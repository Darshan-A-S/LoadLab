import { Tag as TagIcon } from 'lucide-react'

export interface TagBadgeProps {
  tag: string
  size?: 'sm' | 'md'
  onRemove?: () => void
  onClick?: () => void
}

export function getTagColorClass(_tag: string): string {
  return ''
}

export default function TagBadge({
  tag,
  size = 'md',
  onRemove,
  onClick
}: TagBadgeProps): JSX.Element {
  const iconSize = size === 'sm' ? 10 : 11

  return (
    <span
      className={`tag-pill tag-size-${size} ${onClick ? 'tag-clickable' : ''}`}
      onClick={onClick}
      title={onClick ? `Tag: ${tag} (click to change)` : `Tag: ${tag}`}
    >
      <TagIcon size={iconSize} className="tag-icon" />
      <span className="tag-text">{tag}</span>
      {onRemove && (
        <button
          type="button"
          className="tag-remove-btn"
          title={`Remove tag ${tag}`}
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
        >
          ✕
        </button>
      )}
    </span>
  )
}
