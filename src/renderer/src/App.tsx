import { useEffect, useState } from 'react'
import Builder from './components/Builder'
import Dashboard from './components/Dashboard'
import ResultCard from './components/ResultCard'
import History from './components/History'
import Scenarios from './components/Scenarios'
import type { RunEvent } from '../../preload'
import type { SampleEvent, TestDefinition, TestResult } from '@shared/types'

type Tab = 'new' | 'history' | 'scenarios'

export interface RunningState {
  runId: number
  samples: SampleEvent['sample'][]
}

export default function App(): JSX.Element {
  const [tab, setTab] = useState<Tab>('new')
  const [draft, setDraft] = useState<TestDefinition>(defaultDraft())
  const [running, setRunning] = useState<RunningState | null>(null)
  const [result, setResult] = useState<{ runId: number; status: string; result: TestResult } | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    void window.loadlab.win.isMaximized().then(setMaximized)
    const off = window.loadlab.win.onMaximizedState(setMaximized)
    return off
  }, [])

  useEffect(() => {
    const off = window.loadlab.onRunEvent((ev: RunEvent) => {
      if (ev.type === 'sample') {
        setRunning((r) => {
          if (!r || r.runId !== ev.data.runId) return r
          return { runId: r.runId, samples: [...r.samples, ev.data.sample] }
        })
      } else {
        const d = ev.data
        if (d.status === 'running') {
          setRunning({ runId: d.runId, samples: [] })
        } else {
          setRunning(null)
          if (d.error) setRunError(d.error)
          else if (d.result) {
            setRunError(null)
            setResult({ runId: d.runId, status: d.status, result: d.result })
          } else {
            setRunError('Test ended without a result.')
          }
        }
      }
    })
    return off
  }, [])

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
      <div className="app">
        <nav>
          <button className={tab === 'new' ? 'active' : ''} onClick={() => setTab('new')}>
            New Test
          </button>
        <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
          History
        </button>
        <button className={tab === 'scenarios' ? 'active' : ''} onClick={() => setTab('scenarios')}>
          Saved Tests
        </button>
      </nav>
      <main>
        {tab === 'new' &&
          (running ? (
            <Dashboard
              runId={running.runId}
              samples={running.samples}
              onStop={() => void window.loadlab.runs.stop(running.runId)}
            />
          ) : result ? (
            <ResultCard
              result={result.result}
              status={result.status}
              onRunAgain={() => setResult(null)}
            />
          ) : (
            <Builder
              draft={draft}
              onChange={setDraft}
              error={runError}
              onStarted={(runId) => {
                setRunError(null)
                setResult(null)
                setRunning({ runId, samples: [] })
              }}
              onError={setRunError}
            />
          ))}
        {tab === 'history' && <History />}
        {tab === 'scenarios' && (
          <Scenarios
            onLoad={(def) => {
              setDraft(def)
              setResult(null)
              setTab('new')
            }}
          />
        )}
      </main>
      </div>
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