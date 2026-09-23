import { useCallback, useEffect, useState } from 'react'
import Builder from './components/Builder'
import Dashboard from './components/Dashboard'
import ResultCard from './components/ResultCard'
import RunDetail from './components/RunDetail'
import Collection from './components/Collection'
import type { RunEvent } from '../../preload'
import type {
  SampleEvent,
  TestDefinition,
  TestResult,
  Scenario,
  HistoryEntry,
  Collection as CollectionDef
} from '@shared/types'

interface EditorTab {
  kind: 'editor'
  id: number
  savedId: number | null
  collectionId: number | null
  draft: TestDefinition
  base: string
  running: RunningState | null
  result: { runId: number; status: string; result: TestResult } | null
  error: string | null
}

interface RunTab {
  kind: 'run'
  id: number
  run: HistoryEntry
}

type Tab = EditorTab | RunTab

export interface RunningState {
  runId: number
  samples: SampleEvent['sample'][]
}

let nextTabId = 1

export default function App(): JSX.Element {
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [collections, setCollections] = useState<CollectionDef[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [maximized, setMaximized] = useState(false)
  const [closeProbe, setCloseProbe] = useState<number | null>(null)
  const [detailRun, setDetailRun] = useState<HistoryEntry | null>(null)
  const [resultPopup, setResultPopup] = useState<{ runId: number; status: string; result: TestResult } | null>(null)
  const [pickTarget, setPickTarget] = useState<{ tabId: number; closeAfter: boolean } | null>(null)
  const [newCollOpen, setNewCollOpen] = useState(false)
  const [newCollName, setNewCollName] = useState('')
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const n = Number(localStorage.getItem('sidebarWidth'))
    return Number.isFinite(n) && n >= 240 ? n : 240
  })

  function onResizeStart(e: React.MouseEvent): void {
    e.preventDefault()
    const move = (ev: MouseEvent): void => {
      const w = Math.max(240, Math.round(ev.clientX))
      setSidebarWidth(w)
      localStorage.setItem('sidebarWidth', String(w))
    }
    const up = (): void => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  useEffect(() => {
    void window.loadlab.win.isMaximized().then(setMaximized)
    const off = window.loadlab.win.onMaximizedState(setMaximized)
    return off
  }, [])

  const refreshScenarios = useCallback((): void => {
    void window.loadlab.scenarios.list().then(setScenarios)
  }, [])

  const refreshCollections = useCallback((): void => {
    void window.loadlab.collections.list().then(setCollections)
  }, [])

  const refreshHistory = useCallback((): void => {
    void window.loadlab.runs.list().then(setHistory)
  }, [])

  useEffect(() => {
    refreshScenarios()
    refreshCollections()
    refreshHistory()
    const off = window.loadlab.onRunEvent((ev: RunEvent) => {
      if (ev.type === 'sample') {
        const { runId, sample } = ev.data
        setTabs((ts) =>
          ts.map((t) =>
            t.kind === 'editor' && t.running && t.running.runId === runId
              ? { ...t, running: { runId, samples: [...t.running.samples, sample] } }
              : t
          )
        )
      } else {
        const d = ev.data as Extract<RunEvent, { type: 'result' }>['data']
        if (d.result) setResultPopup({ runId: d.runId, status: d.status, result: d.result })
        setTabs((ts) =>
          ts.map((t) => {
            if (t.kind !== 'editor' || !t.running || t.running.runId !== d.runId) return t
            if (d.status === 'running') return { ...t, running: { runId: d.runId, samples: [] } }
            if (d.error) return { ...t, running: null, error: d.error }
            if (d.result) {
              return { ...t, running: null, result: { runId: d.runId, status: d.status, result: d.result } }
            }
            return { ...t, running: null, error: 'Test ended without a result.' }
          })
        )
        if (d.status !== 'running') refreshHistory()
      }
    })
    return off
  }, [refreshHistory, refreshScenarios])

  const activeTab = tabs.find((t) => t.id === activeId) ?? null

  function updateActive(updater: (t: EditorTab) => EditorTab): void {
    setTabs((ts) => ts.map((t) => (t.kind === 'editor' && t.id === activeId ? updater(t) : t)))
  }

  const newTab = useCallback((collectionId: number | null = null): void => {
    const id = nextTabId++
    const draft = defaultDraft()
    setTabs((ts) => [
      ...ts,
      { kind: 'editor', id, savedId: null, collectionId, draft, base: JSON.stringify(draft), running: null, result: null, error: null }
    ])
    setActiveId(id)
  }, [])

  const openScenario = useCallback((s: Scenario): void => {
    const existing = tabs.find((t) => t.kind === 'editor' && t.savedId === s.id)
    if (existing) {
      setActiveId(existing.id)
      return
    }
    const id = nextTabId++
    const draft = structuredClone(s.config)
    setTabs((ts) => [
      ...ts,
      { kind: 'editor', id, savedId: s.id, collectionId: s.collectionId, draft, base: JSON.stringify(draft), running: null, result: null, error: null }
    ])
    setActiveId(id)
  }, [tabs])

  const openHistory = useCallback((run: HistoryEntry): void => {
    if (run.status === 'completed') {
      setDetailRun(run)
      return
    }
    const existing = tabs.find((t) => t.kind === 'run' && t.run.runId === run.runId)
    if (existing) {
      setActiveId(existing.id)
      return
    }
    const id = nextTabId++
    setTabs((ts) => [...ts, { kind: 'run', id, run }])
    setActiveId(id)
  }, [tabs])

  const closeTab = useCallback((id: number): void => {
    const t = tabs.find((x) => x.id === id)
    if (t?.kind === 'editor' && t.draft !== undefined && JSON.stringify(t.draft) !== t.base) {
      setCloseProbe(id)
      return
    }
    doClose(id)
  }, [tabs, activeId])

  const doClose = useCallback((id: number): void => {
    setTabs((ts) => {
      const idx = ts.findIndex((t) => t.id === id)
      const next = ts.filter((t) => t.id !== id)
      if (activeId === id) setActiveId(next[Math.min(idx, next.length - 1)]?.id ?? null)
      return next
    })
  }, [activeId])

  function saveTabTo(tabId: number, draft: TestDefinition, collectionId: number | null): void {
    const test = { ...draft, name: draft.name.trim() || 'Untitled' }
    void window.loadlab.scenarios.save(test, collectionId).then(({ id }) => {
      setTabs((ts) =>
        ts.map((t) =>
          t.kind === 'editor' && t.id === tabId
            ? { ...t, savedId: id, collectionId, base: JSON.stringify(t.draft) }
            : t
        )
      )
      refreshScenarios()
    })
  }

  function saveActive(): void {
    const t = tabs.find((x) => x.kind === 'editor' && x.id === activeId)
    if (!t) return
    if (t.collectionId == null) setPickTarget({ tabId: t.id, closeAfter: false })
    else saveTabTo(t.id, t.draft, t.collectionId)
  }

  function runAgain(): void {
    if (!resultPopup) return
    const tab = tabs.find((t) => t.kind === 'editor' && t.result && t.result.runId === resultPopup.runId)
    setResultPopup(null)
    if (!tab) return
    const set = (err: unknown): void =>
      setTabs((ts) =>
        ts.map((t) =>
          t.kind === 'editor' && t.id === tab.id
            ? { ...t, running: null, error: err instanceof Error ? err.message : String(err), result: null }
            : t
        )
      )
    void window.loadlab.runs.start(tab.draft).then(
      (runId) =>
        setTabs((ts) =>
          ts.map((t) =>
            t.kind === 'editor' && t.id === tab.id
              ? { ...t, running: { runId, samples: [] }, error: null, result: null }
              : t
          )
        ),
      set
    )
  }

  function handleCloseChoice(choice: 'save' | 'discard' | 'cancel'): void {
    if (closeProbe == null) return
    const t = tabs.find((x) => x.kind === 'editor' && x.id === closeProbe)
    if (choice === 'discard') {
      const id = closeProbe
      setCloseProbe(null)
      doClose(id)
      return
    }
    if (choice === 'cancel') {
      setCloseProbe(null)
      return
    }
    // save
    if (!t) {
      setCloseProbe(null)
      return
    }
    if (t.collectionId == null) {
      setPickTarget({ tabId: closeProbe, closeAfter: true })
      setCloseProbe(null)
    } else {
      saveTabTo(closeProbe, t.draft, t.collectionId)
      setCloseProbe(null)
      doClose(closeProbe)
    }
  }

  function handlePickCollection(collectionId: number): void {
    if (!pickTarget) return
    const { tabId, closeAfter } = pickTarget
    setPickTarget(null)
    const t = tabs.find((x) => x.kind === 'editor' && x.id === tabId)
    if (!t) return
    saveTabTo(tabId, t.draft, collectionId)
    if (closeAfter) doClose(tabId)
  }

  async function createCollection(): Promise<void> {
    const name = newCollName.trim()
    if (!name) return
    await window.loadlab.collections.create(name)
    setNewCollName('')
    setNewCollOpen(false)
    refreshCollections()
  }

  const [renameColl, setRenameColl] = useState<CollectionDef | null>(null)
  const [renameName, setRenameName] = useState('')

  function renameCollection(c: CollectionDef): void {
    setRenameColl(c)
    setRenameName(c.name)
  }

  async function submitRename(): Promise<void> {
    if (!renameColl) return
    const name = renameName.trim()
    if (!name) { setRenameColl(null); return }
    await window.loadlab.collections.rename(renameColl.id, name)
    setRenameColl(null)
    refreshCollections()
  }

  function duplicateCollection(id: number): void {
    void window.loadlab.collections.duplicate(id).then(() => refreshCollections())
  }

  function deleteCollection(id: number): void {
    void window.loadlab.collections.delete(id).then(refreshCollections)
  }

  function deleteScenario(id: number): void {
    void window.loadlab.scenarios.delete(id).then(refreshScenarios)
  }

  function tabLabel(t: Tab): string {
    if (t.kind === 'editor') return t.draft.name.trim() || 'Untitled'
    return t.run.name || 'Run'
  }

  return (
    <div className="window">
      <div className="titlebar" onDoubleClick={() => window.loadlab.win.toggleMaximize()}>
        <div className="brand">
          <span className="logo">Load</span>
          <span className="logo-accent">Lab</span>
        </div>
        <div className="win-controls">
          <button title="Minimize" onClick={() => window.loadlab.win.minimize()}>
            <svg width="10" height="10" viewBox="0 0 10 10">
              <line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" strokeWidth="1" />
            </svg>
          </button>
          <button title={maximized ? 'Restore' : 'Maximize'} onClick={() => window.loadlab.win.toggleMaximize()}>
            {maximized ? (
              <svg width="10" height="10" viewBox="0 0 10 10">
                <rect x="1.5" y="3" width="6" height="6" fill="none" stroke="currentColor" strokeWidth="1" />
                <path d="M3.5 3v-1.5h5v5H7" fill="none" stroke="currentColor" strokeWidth="1" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10">
                <rect x="1.5" y="1.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1" />
              </svg>
            )}
          </button>
          <button className="close" title="Close" onClick={() => window.loadlab.win.close()}>
            <svg width="10" height="10" viewBox="0 0 10 10">
              <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1" />
              <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1" />
            </svg>
          </button>
        </div>
      </div>

<div className="workbench">
        <div className="slide-wrapper" style={{ width: Math.max(240, sidebarWidth) }}>
          <Collection
            scenarios={scenarios}
            collections={collections}
            history={history}
            onOpenScenario={openScenario}
            onDeleteScenario={deleteScenario}
            onOpenHistory={openHistory}
            onNewInCollection={(collectionId) => newTab(collectionId)}
            onNewCollection={() => setNewCollOpen(true)}
            onRenameCollection={renameCollection}
            onDuplicateCollection={duplicateCollection}
            onDeleteCollection={deleteCollection}
          />
        </div>
        <div className="resizer" onMouseDown={onResizeStart} />
        <div className="workspace">
          <div className="tabbar">
            {tabs.map((t) => (
              <button
                key={t.id}
                className={t.id === activeId ? 'active' : ''}
                onClick={() => setActiveId(t.id)}
                onAuxClick={(e) => {
                  if (e.button === 1) closeTab(t.id)
                }}
              >
                <span className="gtab-name">
                  {t.kind === 'editor' && t.running && <span className="gtab-dot" />}
                  {tabLabel(t)}
                </span>
                <span
                  className="gtab-close"
                  onClick={(e) => {
                    e.stopPropagation()
                    closeTab(t.id)
                  }}
                >
                  ✕
                </span>
              </button>
            ))}
            <button className="gtab-new" title="New Test" onClick={() => newTab()}>
              +
            </button>
            <span className="grow" />
          </div>
          <main>
            {!activeTab ? (
              <div className="empty" style={{ height: '100%' }}>
                Select a saved test or create a new one.
              </div>
            ) : activeTab.kind === 'run' ? (
              <RunDetail run={activeTab.run} />
            ) : activeTab.running ? (
              <Dashboard
                runId={activeTab.running.runId}
                samples={activeTab.running.samples}
                onStop={() => void window.loadlab.runs.stop(activeTab.running!.runId)}
              />
            ) : (
              <Builder
                draft={activeTab.draft}
                onChange={(d) => updateActive((t) => ({ ...t, draft: d }))}
                error={activeTab.error}
                onStarted={(runId) => updateActive((t) => ({ ...t, running: { runId, samples: [] }, error: null, result: null }))}
                onError={(msg) => updateActive((t) => ({ ...t, error: msg }))}
                onSave={saveActive}
              />
            )}
          </main>
        </div>
      </div>

      <div className="statusbar">
        <span className="status-left">
          {activeTab?.kind === 'editor' && activeTab.running
            ? `Running run #${activeTab.running.runId}`
            : activeTab?.kind === 'editor' && activeTab.result
              ? `Run #${activeTab.result.runId} ${activeTab.result.status}`
              : 'Ready'}
        </span>
        <span className="grow" />
        <span className="status-right">Autocannon</span>
      </div>

      {closeProbe != null && (
        <div className="modal-backdrop" onClick={() => setCloseProbe(null)}>
          <div className="modal">
            <p>You have unsaved changes. Save before closing?</p>
            <div className="actions">
              <button onClick={() => handleCloseChoice('cancel')}>Cancel</button>
              <button onClick={() => handleCloseChoice('discard')}>Discard</button>
              <button className="primary" onClick={() => handleCloseChoice('save')}>Save</button>
            </div>
          </div>
        </div>
      )}

      {pickTarget != null && (
        <div className="modal-backdrop" onClick={() => setPickTarget(null)}>
          <div className="modal">
            <p>Choose a collection to save into:</p>
            <div className="picker-list">
              {collections.map((c) => (
                <button key={c.id} onClick={() => handlePickCollection(c.id)}>
                  {c.name}
                </button>
              ))}
              <button className="picker-new" onClick={() => setNewCollOpen(true)}>
                + New Collection
              </button>
            </div>
            <div className="actions">
              <button onClick={() => setPickTarget(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {renameColl && (
        <div className="modal-backdrop" onClick={() => setRenameColl(null)}>
          <div className="modal">
            <p>Rename collection</p>
            <input
              autoFocus
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submitRename()
              }}
            />
            <div className="actions">
              <button onClick={() => setRenameColl(null)}>Cancel</button>
              <button className="primary" onClick={() => void submitRename()}>Rename</button>
            </div>
          </div>
        </div>
      )}

      {newCollOpen && (
        <div className="modal-backdrop" onClick={() => setNewCollOpen(false)}>
          <div className="modal">
            <p>New collection name</p>
            <input
              autoFocus
              value={newCollName}
              onChange={(e) => setNewCollName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void createCollection()
              }}
            />
            <div className="actions">
              <button onClick={() => setNewCollOpen(false)}>Cancel</button>
              <button className="primary" onClick={() => void createCollection()}>Create</button>
            </div>
          </div>
        </div>
      )}

      {resultPopup && (
        <div className="modal-backdrop" onClick={() => setResultPopup(null)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <ResultCard
              result={resultPopup.result}
              status={resultPopup.status}
              onRunAgain={runAgain}
            />
            <div className="actions">
              <button onClick={() => setResultPopup(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {detailRun && (
        <div className="modal-backdrop" onClick={() => setDetailRun(null)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <RunDetail run={detailRun} />
            <div className="actions">
              <button className="primary" onClick={() => setDetailRun(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function defaultDraft(): TestDefinition {
  return {
    name: '',
    target: { url: 'http://localhost:3000/', method: 'GET', headers: {}, body: '' },
    load: { connections: 100, durationSeconds: 30, pipelining: 1, rate: undefined },
    engine: 'autocannon'
  }
}