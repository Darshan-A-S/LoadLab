import { useCallback, useEffect, useState } from 'react'
import Builder from './components/Builder'
import Dashboard from './components/Dashboard'
import ResultCard from './components/ResultCard'
import RunDetail from './components/RunDetail'
import Collection from './components/Collection'
import ComparePicker from './components/ComparePicker'
import CompareRuns from './components/CompareRuns'
import { ENGINE_DEFAULTS } from '@shared/types'
import { getAvailableName } from '@shared/validation'
import type {
  SampleEvent,
  ResultEvent,
  RunEvent,
  TestDefinition,
  TestResult,
  Scenario,
  HistoryEntry,
  Collection as CollectionDef,
  EngineType
} from '@shared/types'

interface CollisionState {
  mode: 'import' | 'normal'
  name: string
  existingCollection: { id: number; name: string }
  suggestedName: string
  configs?: TestDefinition[]
  skipped?: string[]
  pendingTabId?: number | null
  closeAfter?: boolean
}


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

function isEditorTab(t: Tab): t is EditorTab {
  return t.kind === 'editor'
}

export interface RunningState {
  runId: number
  samples: SampleEvent['sample'][]
  startedAt?: number
  engine?: EngineType
  durationSeconds?: number
  connections?: number
  targetUrl?: string
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
  const [resultPopup, setResultPopup] = useState<{ runId: number; status: string; result: TestResult } | null>(null)
  const [comparePickerRun, setComparePickerRun] = useState<HistoryEntry | null>(null)
  const [compareModal, setCompareModal] = useState<{ runA: HistoryEntry; runB: HistoryEntry } | null>(null)
  const [pickTarget, setPickTarget] = useState<{ tabId: number; closeAfter: boolean } | null>(null)
  const [deleteScenarioTarget, setDeleteScenarioTarget] = useState<{ id: number; name: string } | null>(null)
  const [deleteCollectionTarget, setDeleteCollectionTarget] = useState<{ id: number; name: string } | null>(null)
  const [newCollOpen, setNewCollOpen] = useState(false)
  const [newCollName, setNewCollName] = useState('')
  const [saveToNewCollTarget, setSaveToNewCollTarget] = useState<{ tabId: number; closeAfter: boolean } | null>(null)
  const [collisionData, setCollisionData] = useState<CollisionState | null>(null)
  const [collisionChoice, setCollisionChoice] = useState<'replace' | 'new' | 'cancel'>('replace')
  const [collisionNewName, setCollisionNewName] = useState('')
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
    void window.loadlab.runs.list().then((list) => {
      setHistory(list)
      setTabs((ts) =>
        ts.map((t) => {
          if (t.kind !== 'run') return t
          const updated = list.find((h) => h.runId === t.run.runId)
          return updated ? { ...t, run: updated } : t
        })
      )
    })
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
              ? { ...t, running: { ...t.running, samples: [...t.running.samples, sample] } }
              : t
          )
        )
      } else {
        const d = ev.data as Extract<RunEvent, { type: 'result' }>['data']
        if (d.result) {
          const tab = tabs.find(
            (t): t is EditorTab => t.kind === 'editor' && t.running !== null && t.running.runId === d.runId
          )
          if (tab && tab.draft.tags && tab.draft.tags.length && (!d.result.tags || !d.result.tags.length)) {
            d.result.tags = [tab.draft.tags[0]]
          }
          setResultPopup({ runId: d.runId, status: d.status, result: d.result })
        }
        setTabs((ts) =>
          ts.map((t) => {
            if (t.kind !== 'editor' || !t.running || t.running.runId !== d.runId) return t
            if (d.status === 'running') return { ...t, running: { ...t.running, runId: d.runId } }
            if (d.error) return { ...t, running: null, error: d.error }
            if (d.result) {
              const resTags = d.result.tags && d.result.tags.length ? [d.result.tags[0]] : (t.draft.tags && t.draft.tags.length ? [t.draft.tags[0]] : [])
              const updatedResult = { ...d.result, tags: resTags }
              return { ...t, running: null, result: { runId: d.runId, status: d.status, result: updatedResult } }
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        newTab()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [newTab])

  const openScenario = useCallback((s: Scenario): void => {
    const existing = tabs.find((t): t is EditorTab => t.kind === 'editor' && t.savedId === s.id)
    if (existing) {
      setActiveId(existing.id)
      return
    }
    const id = nextTabId++
    const draft = structuredClone(s.config)
    if (s.tags && (!draft.tags || draft.tags.length === 0)) {
      draft.tags = [...s.tags]
    }
    setTabs((ts) => [
      ...ts,
      { kind: 'editor', id, savedId: s.id, collectionId: s.collectionId, draft, base: JSON.stringify(draft), running: null, result: null, error: null }
    ])
    setActiveId(id)
  }, [tabs])

  const openHistory = useCallback((run: HistoryEntry): void => {
    const existing = tabs.find((t) => t.kind === 'run' && t.run.runId === run.runId)
    if (existing) {
      setActiveId(existing.id)
      return
    }
    const id = nextTabId++
    setTabs((ts) => [...ts, { kind: 'run', id, run }])
    setActiveId(id)
  }, [tabs])

  const openRunInEditor = useCallback((run: HistoryEntry): void => {
    // 1. If this run matches a saved scenario, open that scenario (or switch to its tab if already open)
    const matchingScenario = scenarios.find(
      (s) => s.name.trim().toLowerCase() === run.name.trim().toLowerCase()
    )
    if (matchingScenario) {
      openScenario(matchingScenario)
      return
    }

    // 2. If an editor tab with this test name or URL is already open, switch to it
    const existingEditor = tabs.find(
      (t): t is EditorTab =>
        t.kind === 'editor' &&
        ((t.draft.name.trim() && t.draft.name.trim().toLowerCase() === run.name.trim().toLowerCase()) ||
          t.draft.target.url === run.target)
    )
    if (existingEditor) {
      setActiveId(existingEditor.id)
      return
    }

    // 3. Otherwise, open that test in a new editor tab (keeping original test name, no "(Copy)")
    const id = nextTabId++
    const draft: TestDefinition = {
      name: run.name || 'Untitled Test',
      target: { url: run.target, method: 'GET', headers: {}, body: '' },
      load: {
        connections: ENGINE_DEFAULTS[(run.engine as EngineType) || 'autocannon']?.connections ?? 50,
        durationSeconds: run.result?.durationSec ?? 30,
        pipelining: 1
      },
      engine: (run.engine as EngineType) || 'autocannon',
      tags: run.tags ? [...run.tags] : []
    }
    setTabs((ts) => [
      ...ts,
      {
        kind: 'editor',
        id,
        savedId: null,
        collectionId: null,
        draft,
        base: JSON.stringify(draft),
        running: null,
        result: null,
        error: null
      }
    ])
    setActiveId(id)
  }, [scenarios, tabs, openScenario])

  const closeTab = useCallback((id: number): void => {
    const t = tabs.find((x) => x.id === id)
    if (t && isEditorTab(t) && JSON.stringify(t.draft) !== t.base) {
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
    const t = tabs.find((x): x is EditorTab => x.kind === 'editor' && x.id === activeId)
    if (!t) return
    if (t.collectionId == null) {
      if (collections.length === 0) {
        setSaveToNewCollTarget({ tabId: t.id, closeAfter: false })
      } else {
        setPickTarget({ tabId: t.id, closeAfter: false })
      }
    } else {
      saveTabTo(t.id, t.draft, t.collectionId)
    }
  }

  function runAgain(): void {
    if (!resultPopup) return
    const tab = tabs.find(
      (t): t is EditorTab => t.kind === 'editor' && t.result !== null && t.result.runId === resultPopup.runId
    )
    if (tab && resultPopup.result.tags && resultPopup.result.tags.length) {
      tab.draft.tags = [resultPopup.result.tags[0]]
    }
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
              ? {
                  ...t,
                  running: {
                    runId,
                    samples: [],
                    startedAt: Date.now(),
                    engine: tab.draft.engine,
                    durationSeconds: Number(tab.draft.load.durationSeconds) || 30,
                    connections: Number(tab.draft.load.connections) || 10,
                    targetUrl: tab.draft.target.url
                  },
                  error: null,
                  result: null
                }
              : t
          )
        ),
      set
    )
  }

  const startCompare = useCallback((run: HistoryEntry): void => {
    setComparePickerRun(run)
  }, [])

  const handleSelectCompareCandidate = useCallback(
    (candidate: HistoryEntry): void => {
      if (!comparePickerRun) return
      setCompareModal({ runA: comparePickerRun, runB: candidate })
      setComparePickerRun(null)
      setResultPopup(null)
    },
    [comparePickerRun]
  )

  const handleResultPopupCompare = useCallback((): void => {
    if (!resultPopup) return
    const found = history.find((h) => h.runId === resultPopup.runId)
    if (found) {
      startCompare(found)
    } else {
      const activeTab = tabs.find(
        (t): t is EditorTab => t.kind === 'editor' && t.result?.runId === resultPopup.runId
      )
      const synthetic: HistoryEntry = {
        runId: resultPopup.runId,
        name: activeTab?.draft.name || 'Current Test',
        target: activeTab?.draft.target.url || '',
        engine: activeTab?.draft.engine || 'autocannon',
        status: 'completed',
        startedAt: resultPopup.result.startedAt,
        finishedAt: resultPopup.result.finishedAt,
        result: resultPopup.result
      }
      startCompare(synthetic)
    }
  }, [resultPopup, history, tabs, startCompare])

  function handleCloseChoice(choice: 'save' | 'discard' | 'cancel'): void {
    if (closeProbe == null) return
    const t = tabs.find((x): x is EditorTab => x.kind === 'editor' && x.id === closeProbe)
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
      if (collections.length === 0) {
        setSaveToNewCollTarget({ tabId: closeProbe, closeAfter: true })
      } else {
        setPickTarget({ tabId: closeProbe, closeAfter: true })
      }
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
    const t = tabs.find((x): x is EditorTab => x.kind === 'editor' && x.id === tabId)
    if (!t) return
    saveTabTo(tabId, t.draft, collectionId)
    if (closeAfter) doClose(tabId)
  }

  async function createCollection(): Promise<void> {
    const name = newCollName.trim()
    if (!name) return

    const normalColls = collections.filter((c) => !c.isImported)
    const existing = normalColls.find((c) => c.name.trim().toLowerCase() === name.toLowerCase())

    if (existing) {
      const suggestedName = getAvailableName(
        name,
        normalColls.map((c) => c.name)
      )
      setCollisionData({
        mode: 'normal',
        name,
        existingCollection: { id: existing.id, name: existing.name },
        suggestedName
      })
      setCollisionChoice('replace')
      setCollisionNewName(suggestedName)
      setNewCollOpen(false)
      setNewCollName('')
      return
    }

    try {
      await window.loadlab.collections.create(name)
      setNewCollName('')
      setNewCollOpen(false)
      refreshCollections()
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleCreateAndSaveTab(): Promise<void> {
    if (!saveToNewCollTarget) return
    const name = newCollName.trim()
    if (!name) return

    const normalColls = collections.filter((c) => !c.isImported)
    const existing = normalColls.find((c) => c.name.trim().toLowerCase() === name.toLowerCase())

    if (existing) {
      const suggestedName = getAvailableName(
        name,
        normalColls.map((c) => c.name)
      )
      setCollisionData({
        mode: 'normal',
        name,
        existingCollection: { id: existing.id, name: existing.name },
        suggestedName,
        pendingTabId: saveToNewCollTarget.tabId,
        closeAfter: saveToNewCollTarget.closeAfter
      })
      setCollisionChoice('replace')
      setCollisionNewName(suggestedName)
      setSaveToNewCollTarget(null)
      setNewCollName('')
      return
    }

    try {
      const { id } = await window.loadlab.collections.create(name)
      const tabId = saveToNewCollTarget.tabId
      const shouldClose = saveToNewCollTarget.closeAfter
      setSaveToNewCollTarget(null)
      setNewCollName('')

      const t = tabs.find((x): x is EditorTab => x.kind === 'editor' && x.id === tabId)
      if (t) {
        saveTabTo(tabId, t.draft, id)
        if (shouldClose) doClose(tabId)
      }
      refreshCollections()
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err))
    }
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
    const sameSection = collections.filter(
      (c) => c.id !== renameColl.id && Boolean(c.isImported) === Boolean(renameColl.isImported)
    )
    if (sameSection.some((c) => c.name.trim().toLowerCase() === name.toLowerCase())) {
      alert(`A collection named "${name}" already exists in this section.`)
      return
    }
    await window.loadlab.collections.rename(renameColl.id, name)
    setRenameColl(null)
    refreshCollections()
  }

  function duplicateCollection(id: number): void {
    void window.loadlab.collections.duplicate(id).then(() => refreshCollections())
  }

  function exportCollection(id: number): void {
    void window.loadlab.collections.export(id).catch((err) =>
      alert(err instanceof Error ? err.message : String(err))
    )
  }

  function importCollection(): void {
    void window.loadlab.collections
      .import()
      .then((res) => {
        if (!res) return
        if (res.status === 'collision') {
          setCollisionData({
            mode: 'import',
            name: res.name,
            existingCollection: res.existingCollection,
            suggestedName: res.suggestedName,
            configs: res.configs,
            skipped: res.skipped
          })
          setCollisionChoice('replace')
          setCollisionNewName(res.suggestedName)
          return
        }
        refreshCollections()
        refreshScenarios()
        if (res.skipped.length > 0) {
          alert(`Imported ${res.imported} scenarios into "${res.name}".\nSkipped: ${res.skipped.join(', ')}`)
        }
      })
      .catch((err) => alert(err instanceof Error ? err.message : String(err)))
  }

  async function handleConfirmCollision(): Promise<void> {
    if (!collisionData) return
    const { mode, name, existingCollection, suggestedName, configs, skipped, pendingTabId, closeAfter } = collisionData
    setCollisionData(null)

    if (collisionChoice === 'cancel') {
      return
    }

    if (mode === 'import') {
      if (!configs) return
      if (collisionChoice === 'replace') {
        try {
          const res = await window.loadlab.collections.replace(existingCollection.id, name, configs)
          refreshCollections()
          refreshScenarios()
          if (skipped && skipped.length > 0) {
            alert(`Imported ${res.imported} scenarios into "${res.name}".\nSkipped: ${skipped.join(', ')}`)
          }
        } catch (err) {
          alert(err instanceof Error ? err.message : String(err))
        }
      } else if (collisionChoice === 'new') {
        const finalName = collisionNewName.trim() || suggestedName
        try {
          const res = await window.loadlab.collections.createImported(finalName, configs)
          refreshCollections()
          refreshScenarios()
          if (skipped && skipped.length > 0) {
            alert(`Imported ${res.imported} scenarios into "${res.name}".\nSkipped: ${skipped.join(', ')}`)
          }
        } catch (err) {
          alert(err instanceof Error ? err.message : String(err))
        }
      }
    } else {
      // mode === 'normal'
      if (collisionChoice === 'replace') {
        try {
          await window.loadlab.collections.clearScenarios(existingCollection.id)
          if (pendingTabId != null) {
            const t = tabs.find((x): x is EditorTab => x.kind === 'editor' && x.id === pendingTabId)
            if (t) {
              saveTabTo(pendingTabId, t.draft, existingCollection.id)
              if (closeAfter) doClose(pendingTabId)
            }
          }
          refreshCollections()
          refreshScenarios()
        } catch (err) {
          alert(err instanceof Error ? err.message : String(err))
        }
      } else if (collisionChoice === 'new') {
        const finalName = collisionNewName.trim() || suggestedName
        try {
          const { id } = await window.loadlab.collections.create(finalName)
          if (pendingTabId != null) {
            const t = tabs.find((x): x is EditorTab => x.kind === 'editor' && x.id === pendingTabId)
            if (t) {
              saveTabTo(pendingTabId, t.draft, id)
              if (closeAfter) doClose(pendingTabId)
            }
          }
          refreshCollections()
        } catch (err) {
          alert(err instanceof Error ? err.message : String(err))
        }
      }
    }
  }

  function promptDeleteCollection(id: number): void {
    const c = collections.find((x) => x.id === id)
    setDeleteCollectionTarget({ id, name: c?.name || 'this collection' })
  }

  function confirmDeleteCollection(): void {
    if (!deleteCollectionTarget) return
    const id = deleteCollectionTarget.id
    setDeleteCollectionTarget(null)
    void window.loadlab.collections.delete(id).then(() => {
      refreshCollections()
      refreshScenarios()
    })
  }

  function promptDeleteScenario(id: number): void {
    const s = scenarios.find((x) => x.id === id)
    setDeleteScenarioTarget({ id, name: s?.name.trim() || 'Untitled Test' })
  }

  function confirmDeleteScenario(): void {
    if (!deleteScenarioTarget) return
    const id = deleteScenarioTarget.id
    setDeleteScenarioTarget(null)
    void window.loadlab.scenarios.delete(id).then(() => {
      setTabs((ts) =>
        ts.map((t) => (t.kind === 'editor' && t.savedId === id ? { ...t, savedId: null } : t))
      )
      refreshScenarios()
    })
  }

  function tabLabel(t: Tab): string {
    if (t.kind === 'editor') return t.draft.name.trim() || 'Untitled'
    return `#${t.run.runId} ${t.run.name || 'Run'}`
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
            onDeleteScenario={promptDeleteScenario}
            onOpenHistory={openHistory}
            onCompareRun={startCompare}
            onNewInCollection={(collectionId) => newTab(collectionId)}
            onNewCollection={() => setNewCollOpen(true)}
            onRenameCollection={renameCollection}
            onDuplicateCollection={duplicateCollection}
            onDeleteCollection={promptDeleteCollection}
            onExportCollection={exportCollection}
            onImportCollection={importCollection}
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
                title={
                  t.kind === 'editor'
                    ? t.draft.name.trim() || 'Untitled Test'
                    : `Run #${t.run.runId}: ${t.run.name || 'Run'}`
                }
                onAuxClick={(e) => {
                  if (e.button === 1) closeTab(t.id)
                }}
              >
                <span className="gtab-name">
                  {t.kind === 'editor' && t.running && <span className="gtab-dot" />}
                  {t.kind === 'run' && (
                    <span
                      className={`gtab-run-dot ${
                        t.run.status === 'completed'
                          ? 'dot-ok'
                          : t.run.status === 'stopped'
                            ? 'dot-warn'
                            : 'dot-bad'
                      }`}
                    />
                  )}
                  <span className="gtab-text">{tabLabel(t)}</span>
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
            <button className="gtab-new" title="New Test (Ctrl+N)" onClick={() => newTab()}>
              +
            </button>
            <span className="grow" />
          </div>
          <main>
            {!activeTab ? (
              <div
                className="empty"
                style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 14
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
                  LoadLab
                </div>
                <div className="muted" style={{ maxWidth: 320, textAlign: 'center', lineHeight: 1.5 }}>
                  Select a saved test from the sidebar or click below to configure a new load test.
                </div>
                <button
                  className="primary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 18px',
                    fontSize: 13,
                    marginTop: 6
                  }}
                  onClick={() => newTab()}
                >
                  + Create New Test
                </button>
              </div>
            ) : activeTab.kind === 'run' ? (
              <RunDetail
                run={activeTab.run}
                onCompare={(run) => startCompare(run)}
                onOpenInEditor={openRunInEditor}
                onTagsChange={(tags) => {
                  setTabs((ts) =>
                    ts.map((t) => (t.id === activeTab.id && t.kind === 'run' ? { ...t, run: { ...t.run, tags } } : t))
                  )
                  refreshHistory()
                }}
              />
            ) : activeTab.running ? (
              <Dashboard
                runId={activeTab.running.runId}
                samples={activeTab.running.samples}
                startedAt={activeTab.running.startedAt}
                engine={activeTab.running.engine || activeTab.draft.engine}
                durationSec={activeTab.running.durationSeconds || activeTab.draft.load.durationSeconds}
                targetUrl={activeTab.running.targetUrl || activeTab.draft.target.url}
                connections={activeTab.running.connections || activeTab.draft.load.connections}
                onStop={() => void window.loadlab.runs.stop(activeTab.running!.runId)}
              />
            ) : (
              <Builder
                draft={activeTab.draft}
                onChange={(d) =>
                  updateActive((t) => {
                    const nextDraft = typeof d === 'function' ? d(t.draft) : d
                    if (t.savedId != null && JSON.stringify(nextDraft.tags) !== JSON.stringify(t.draft.tags)) {
                      void window.loadlab.scenarios.updateTags(t.savedId, nextDraft.tags || [])
                      refreshScenarios()
                    }
                    return { ...t, draft: nextDraft }
                  })
                }
                error={activeTab.error}
                onStarted={(runId, def) =>
                  updateActive((t) => ({
                    ...t,
                    running: {
                      runId,
                      samples: [],
                      startedAt: Date.now(),
                      engine: def?.engine || t.draft.engine,
                      durationSeconds: Number(def?.load.durationSeconds || t.draft.load.durationSeconds) || 30,
                      connections: Number(def?.load.connections || t.draft.load.connections) || 10,
                      targetUrl: def?.target.url || t.draft.target.url
                    },
                    error: null,
                    result: null
                  }))
                }
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
              : activeTab?.kind === 'run'
                ? `Run #${activeTab.run.runId} (${activeTab.run.status})`
                : 'Ready'}
        </span>
        <span className="grow" />
        <span className="status-right" style={{ textTransform: 'capitalize' }}>
          {activeTab?.kind === 'editor'
            ? activeTab.draft.engine
            : activeTab?.kind === 'run'
              ? activeTab.run.engine
              : 'LoadLab'}
        </span>
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
                  <span>{c.name}</span>
                  {c.isImported && <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 6 }}>(Imported)</span>}
                </button>
              ))}
              <button
                className="picker-new"
                onClick={() => {
                  if (pickTarget) {
                    setSaveToNewCollTarget({ tabId: pickTarget.tabId, closeAfter: pickTarget.closeAfter })
                    setPickTarget(null)
                  }
                }}
              >
                + New Collection
              </button>
            </div>
            <div className="actions">
              <button onClick={() => setPickTarget(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {saveToNewCollTarget && (
        <div className="modal-backdrop" onClick={() => { setSaveToNewCollTarget(null); setNewCollName('') }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <p style={{ margin: '0 0 8px 0', fontSize: 13.5, fontWeight: 600 }}>Create Collection</p>
            <p className="muted" style={{ margin: '0 0 12px 0', fontSize: 12 }}>
              Create a collection to save your test:
            </p>
            <input
              autoFocus
              value={newCollName}
              placeholder="Collection name"
              onChange={(e) => setNewCollName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCreateAndSaveTab()
              }}
            />
            <div className="actions">
              <button onClick={() => { setSaveToNewCollTarget(null); setNewCollName('') }}>Cancel</button>
              <button className="primary" onClick={() => void handleCreateAndSaveTab()}>
                Create & Save
              </button>
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
              onCompare={handleResultPopupCompare}
              onTagsChange={(tags) => {
                setResultPopup((prev) => (prev ? { ...prev, result: { ...prev.result, tags } } : null))
                setTabs((ts) =>
                  ts.map((t) =>
                    t.kind === 'editor' && t.result?.runId === resultPopup.runId
                      ? {
                          ...t,
                          draft: { ...t.draft, tags },
                          result: { ...t.result, result: { ...t.result.result, tags } }
                        }
                      : t
                  )
                )
                refreshHistory()
              }}
            />
            <div className="actions">
              <button onClick={() => setResultPopup(null)}>Close</button>
            </div>
          </div>
        </div>
      )}


      {comparePickerRun && (
        <ComparePicker
          currentRun={comparePickerRun}
          runs={history}
          onSelect={handleSelectCompareCandidate}
          onClose={() => setComparePickerRun(null)}
        />
      )}

      {compareModal && (
        <CompareRuns
          runA={compareModal.runA}
          runB={compareModal.runB}
          allRuns={history}
          onSwap={() =>
            setCompareModal((prev) =>
              prev ? { runA: prev.runB, runB: prev.runA } : null
            )
          }
          onChangeRunA={(runA) =>
            setCompareModal((prev) => (prev ? { ...prev, runA } : null))
          }
          onChangeRunB={(runB) =>
            setCompareModal((prev) => (prev ? { ...prev, runB } : null))
          }
          onClose={() => setCompareModal(null)}
        />
      )}

      {deleteScenarioTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteScenarioTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <p style={{ margin: '0 0 8px 0', fontSize: 13.5, fontWeight: 600 }}>
              Delete Test?
            </p>
            <p className="muted" style={{ margin: '0 0 14px 0', fontSize: 12.5, lineHeight: 1.4 }}>
              Are you sure you want to delete <strong>&quot;{deleteScenarioTarget.name}&quot;</strong>? This action cannot be undone.
            </p>
            <div className="actions">
              <button onClick={() => setDeleteScenarioTarget(null)}>Cancel</button>
              <button className="danger" onClick={confirmDeleteScenario}>
                Delete Test
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteCollectionTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteCollectionTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <p style={{ margin: '0 0 8px 0', fontSize: 13.5, fontWeight: 600 }}>
              Delete Collection?
            </p>
            <p className="muted" style={{ margin: '0 0 14px 0', fontSize: 12.5, lineHeight: 1.4 }}>
              Are you sure you want to delete collection <strong>&quot;{deleteCollectionTarget.name}&quot;</strong>? Tests in this collection will also be deleted.
            </p>
            <div className="actions">
              <button onClick={() => setDeleteCollectionTarget(null)}>Cancel</button>
              <button className="danger" onClick={confirmDeleteCollection}>
                Delete Collection
              </button>
            </div>
          </div>
        </div>
      )}

      {collisionData && (
        <div className="modal-backdrop" onClick={() => setCollisionData(null)}>
          <div className="modal modal-collision" onClick={(e) => e.stopPropagation()}>
            <div className="collision-header">
              <p className="collision-title">
                A collection named &quot;{collisionData.name}&quot; already exists.
              </p>
            </div>

            <div className="collision-options">
              <label className={`collision-option ${collisionChoice === 'replace' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="collisionAction"
                  value="replace"
                  checked={collisionChoice === 'replace'}
                  onChange={() => setCollisionChoice('replace')}
                />
                <div className="collision-option-content">
                  <div className="collision-option-label">Replace existing collection</div>
                </div>
              </label>

              <label className={`collision-option ${collisionChoice === 'new' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="collisionAction"
                  value="new"
                  checked={collisionChoice === 'new'}
                  onChange={() => setCollisionChoice('new')}
                />
                <div className="collision-option-content">
                  <div className="collision-option-label">
                    {collisionData.mode === 'import' ? 'Import as a new collection' : 'Create as a new collection'}
                  </div>
                  {collisionChoice === 'new' && (
                    <div className="collision-input-wrap" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={collisionNewName}
                        onChange={(e) => setCollisionNewName(e.target.value)}
                        placeholder="Collection name"
                        className="collision-name-input"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void handleConfirmCollision()
                        }}
                      />
                    </div>
                  )}
                </div>
              </label>

              <label className={`collision-option ${collisionChoice === 'cancel' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="collisionAction"
                  value="cancel"
                  checked={collisionChoice === 'cancel'}
                  onChange={() => setCollisionChoice('cancel')}
                />
                <div className="collision-option-content">
                  <div className="collision-option-label">Cancel</div>
                </div>
              </label>
            </div>

            <div className="actions">
              <button onClick={() => setCollisionData(null)}>Cancel</button>
              {collisionChoice === 'cancel' ? (
                <button onClick={() => setCollisionData(null)}>Dismiss</button>
              ) : collisionChoice === 'replace' ? (
                <button className="primary" onClick={() => void handleConfirmCollision()}>
                  Replace Collection
                </button>
              ) : (
                <button className="primary" onClick={() => void handleConfirmCollision()}>
                  {collisionData.mode === 'import' ? 'Import Collection' : 'Create Collection'}
                </button>
              )}
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
    load: { ...ENGINE_DEFAULTS.autocannon },
    engine: 'autocannon'
  }
}