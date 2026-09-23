type Panel = 'saved' | 'history'

export default function CollectionTabs({
  panel,
  onChange
}: {
  panel: Panel
  onChange: (p: Panel) => void
}): JSX.Element {
  return (
    <div className="collection-tabs">
      <button
        className={panel === 'saved' ? 'active' : ''}
        title="Saved Tests"
        onClick={() => onChange('saved')}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M4 2h8a1 1 0 0 1 1 1v11l-5-3.5L3 14V3a1 1 0 0 1 1-1z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <span className="collection-tab-divider" />
      <button
        className={panel === 'history' ? 'active' : ''}
        title="History"
        onClick={() => onChange('history')}
      >
<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
            <path d="M8 4.5V8l2.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
      </button>
    </div>
  )
}
