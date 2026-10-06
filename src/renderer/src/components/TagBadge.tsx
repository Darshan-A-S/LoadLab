import { Tag as TagIcon } from 'lucide-react'

export interface TagBadgeProps {
  tag: string
  size?: 'sm' | 'md'
  onRemove?: () => void
  onClick?: () => void
}

export function getTagColorClass(tag: string): string {
  const norm = tag.toLowerCase().trim()
  if (norm === 'prod' || norm === 'production') return 'tag-prod'
  if (norm === 'uat' || norm === 'staging') return 'tag-uat'
  if (norm === 'dev' || norm === 'development') return 'tag-dev'
  if (norm === 'local' || norm === 'localhost') return 'tag-local'
  return 'tag-custom'
}

export default function TagBadge({
  tag,
  size = 'md',
  onRemove,
  onClick
}: TagBadgeProps): JSX.Element {
  const colorClass = getTagColorClass(tag)
  const iconSize = size === 'sm' ? 9 : 11

  return (
    <span
      className={`tag-pill ${colorClass} tag-size-${size} ${onClick ? 'tag-clickable' : ''}`}
      onClick={onClick}
      title={`Tag: ${tag}`}
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
