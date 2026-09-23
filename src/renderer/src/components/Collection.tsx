import { useState } from 'react'
import { ChevronRight, ChevronsRight, Ellipsis, FolderDown, Search } from 'lucide-react'
import CollectionTabs from './CollectionTabs'
import type { Scenario, HistoryEntry, Collection as Coll, RunStatus } from '@shared/types'

interface Props {
  scenarios: Scenario[]
  collections: Coll[]
  history: HistoryEntry[]
  onOpenScenario: (s: Scenario) => void
  onDeleteScenario: (id: number) => void
  onOpenHistory: (run: HistoryEntry) => void
  onNewInCollection: (collectionId: number) => void
  onNewCollection: () => void
  onRenameCollection: (c: Coll) => void
  onDuplicateCollection: (id: number) => void
  onDeleteCollection: (id: number) => void
}

type Panel = 'saved' | 'history'

export default function Collection({
  scenarios,
  collections,
  history,
  onOpenScenario,
  onDeleteScenario,
  onOpenHistory,
  onNewInCollection,
  onNewCollection,
  onRenameCollection,
  onDuplicateCollection,
  onDeleteCollection
}: Props): JSX.Element {
  const [panel, setPanel] = useState<Panel>('saved')
  const [query, setQuery] = useState('')
  const [collectionsOpen, setCollectionsOpen] = useState(true)
  const [openColls, setOpenColls] = useState<Record<number, boolean>>({})
  const [menu, setMenu] = useState<{ id: number; x: number; y: number } | null>(null)

  const toggleColl = (id: number): void => setOpenColls((m) => ({ ...m, [id]: !(m[id] ?? true) }))

  const openMenu = (e: React.MouseEvent, id: number): void => {
    e.stopPropagation()
    const r = e.currentTarget.getBoundingClientRect()
    setMenu((m) => (m && m.id === id ? null : { id, x: r.right + 6, y: r.top }))
  }

  const q = query.trim().toLowerCase()
  const saved = q ? scenarios.filter((s) => s.name.toLowerCase().includes(q)) : scenarios
  const runs = q ? history.filter((r) => r.name.toLowerCase().includes(q)) : history

  const grouped = collections
    .map((c) => ({
      collection: c,
      items: saved.filter((s) => s.collectionId === c.id)
    }))
    .sort((a, b) => {
      const aDef = a.collection.name.toLowerCase() === 'my collection' ? 0 : 1
      const bDef = b.collection.name.toLowerCase() === 'my collection' ? 0 : 1
      return aDef - bDef || a.collection.name.localeCompare(b.collection.name)
    })
  const uncoll = saved.filter((s) => s.collectionId == null || !collections.some((c) => c.id === s.collectionId))

  return (
    <aside className="collection">
      <div className="collection-tabs-wrap">
        <CollectionTabs panel={panel} onChange={setPanel} />
      </div>

      <div className="collection-searchbar-row">
        <div className="collection-search">
          <Search size={13} className="search-icon" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder=""
          />
        </div>
        <button className="collection-icon-btn" title="Import">
          <FolderDown size={14} />
        </button>
      </div>

      {panel === 'saved' ? (
        <div className="collection-section">
          {saved.length === 0 && <div className="collection-empty">{q ? 'No matches' : 'Nothing saved yet'}</div>}
          <div className="collection-collapse-row">
            <button className="collection-collapse" onClick={() => setCollectionsOpen((o) => !o)}>
              <ChevronsRight size={12} className={`collection-chev ${collectionsOpen ? 'open' : ''}`} />
              Collections
            </button>
            <button className="collection-head-add collection-collapse-add" title="New Collection" onClick={onNewCollection}>
              +
            </button>
          </div>
          {collectionsOpen && (
            <div className="collection-groups">
              {grouped.map(({ collection, items }) => (
                <div key={collection.id} className="collection-group">
                  <div className="collection-head">
                    <button className="collection-collapse" onClick={() => toggleColl(collection.id)}>
                      <ChevronRight size={12} className={`collection-chev ${openColls[collection.id] ?? true ? 'open' : ''}`} />
                      <span className="collection-head-name">{collection.name}</span>
                    </button>
                    <button
                      className="collection-head-add"
                      title="New test in collection"
                      onClick={(e) => {
                        e.stopPropagation()
                        onNewInCollection(collection.id)
                      }}
                    >
                      +
                    </button>
                    <div className="collection-menu">
                      <button
                        className="collection-head-add"
                        title="Collection actions"
                        onClick={(e) => openMenu(e, collection.id)}
                      >
                        <Ellipsis size={14} />
                      </button>
                      {menu && menu.id === collection.id && (
                        <>
                          <div className="collection-menu-backdrop" onClick={() => setMenu(null)} />
                          <div className="collection-menu-pop" style={{ left: menu.x, top: menu.y }}>
                          <button onClick={() => { setMenu(null); onNewInCollection(collection.id) }}>
                            New test
                          </button>
                          <button onClick={() => { setMenu(null); onRenameCollection(collection) }}>
                            Rename
                          </button>
                          <button onClick={() => { setMenu(null); onDuplicateCollection(collection.id) }}>
                            Duplicate
                          </button>
                          <button
                            onClick={() => { setMenu(null); onDeleteCollection(collection.id) }}
                            className="danger"
                          >
                            Delete
                          </button>
                        </div>
                        </>
                      )}
                    </div>
                  </div>
                  {(openColls[collection.id] ?? true) &&
                    items.map((s) => (
                      <ScenarioItem key={s.id} s={s} onOpen={onOpenScenario} onDelete={onDeleteScenario} />
                    ))}
                </div>
              ))}
              {uncoll.length > 0 && (
                <div className="collection-group">
                  <div className="collection-head">
                    <button className="collection-collapse" onClick={() => toggleColl(-1)}>
                      <ChevronRight size={12} className={`collection-chev ${openColls[-1] ?? true ? 'open' : ''}`} />
                      <span className="collection-head-name">Unassigned</span>
                    </button>
                  </div>
                  {(openColls[-1] ?? true) &&
                    uncoll.map((s) => (
                      <ScenarioItem key={s.id} s={s} onOpen={onOpenScenario} onDelete={onDeleteScenario} />
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="collection-section">
          {runs.length === 0 && <div className="collection-empty">{q ? 'No matches' : 'No runs yet'}</div>}
          {runs.map((r) => (
            <div key={r.runId} className="collection-item" onClick={() => onOpenHistory(r)}>
              <span className="collection-item-name">{r.name}</span>
              <span className={`badge ${dotClass(r.status)}`} />
            </div>
          ))}
        </div>
      )}
    </aside>
  )
}

function dotClass(status: RunStatus['status']): string {
  switch (status) {
    case 'completed':
      return 'dot-ok'
    case 'running':
    case 'starting':
      return 'dot-run'
    case 'stopped':
    case 'failed':
      return 'dot-bad'
  }
}

function ScenarioItem({
  s,
  onOpen,
  onDelete
}: {
  s: Scenario
  onOpen: (s: Scenario) => void
  onDelete: (id: number) => void
}): JSX.Element {
  return (
    <div className="collection-item" onClick={() => onOpen(s)}>
      <span className="collection-item-name">{s.name}</span>
      <button
        className="collection-item-action"
        title="Delete"
        onClick={(e) => {
          e.stopPropagation()
          onDelete(s.id)
        }}
      >
        ✕
      </button>
    </div>
  )
}