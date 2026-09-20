import { useMemo, useState } from 'react'
import { validate, safetyWarnings } from '@shared/validation'
import type { TestDefinition, HttpMethod } from '@shared/types'

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

interface Props {
  draft: TestDefinition
  onChange: (d: TestDefinition) => void
  error: string | null
  onStarted: (runId: number) => void
  onError: (msg: string) => void
}

export default function Builder({ draft, onChange, error, onStarted, onError }: Props): JSX.Element {
  const [confirm, setConfirm] = useState<{ warning: string } | null>(null)
  const [starting, setStarting] = useState(false)

  const v = useMemo(() => validate(draft), [draft])
  const safety = useMemo(() => safetyWarnings(draft), [draft])

  const set = (patch: Partial<TestDefinition>): void => onChange({ ...draft, ...patch })
  const setLoad = (patch: Partial<TestDefinition['load']>): void =>
    set({ load: { ...draft.load, ...patch } })
  const setTarget = (patch: Partial<TestDefinition['target']>): void =>
    set({ target: { ...draft.target, ...patch } })

  const headers = Object.entries(draft.target.headers ?? {})

  async function start(): Promise<void> {
    const warnings: string[] = []
    if (safety.remoteTarget)
      warnings.push(
        `You are about to generate load against a remote target:\n\n${draft.target.url}\n\nMake sure you are authorized to test this system.`
      )
    if (safety.aggressive)
      warnings.push(
        'This configuration may generate significant traffic and CPU usage.\n\n' +
          `Connections: ${draft.load.connections}, Duration: ${draft.load.durationSeconds}s`
      )
    if (warnings.length) {
      setConfirm({ warning: warnings.join('\n\n') })
      return
    }
    await doStart()
  }

  async function doStart(): Promise<void> {
    setStarting(true)
    onError(null)
    try {
      const runId = await window.loadlab.runs.start(draft)
      onStarted(runId)
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    } finally {
      setStarting(false)
    }
  }

  function saveScenario(): void {
    const name = draft.name.trim() || 'Untitled'
    void window.loadlab.scenarios.save({ ...draft, name }).then(() => void window.loadlab.scenarios.list())
  }

  return (
    <div>
      <div className="headerbar">
        <h1 style={{ margin: 0 }}>New Test</h1>
        <button onClick={saveScenario} disabled={!draft.name.trim()}>
          Save Test
        </button>
      </div>

      <div className="card">
        <h2>Target</h2>
        <label className="field">
          Name
          <input
            value={draft.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="e.g. Local Users API"
          />
        </label>
        <div className="row" style={{ marginTop: 12 }}>
          <label className="field">
            URL
            <input
              value={draft.target.url}
              onChange={(e) => setTarget({ url: e.target.value })}
              placeholder="http://localhost:3000/api/users"
              spellCheck={false}
            />
          </label>
          <label className="field" style={{ maxWidth: 140 }}>
            Method
            <select
              value={draft.target.method}
              onChange={(e) => setTarget({ method: e.target.value as HttpMethod })}
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="card">
        <h2>Load</h2>
        <div className="row">
          <label className="field">
            Connections
            <input
              type="number"
              min={1}
              value={draft.load.connections}
              onChange={(e) => setLoad({ connections: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            Duration (seconds)
            <input
              type="number"
              min={1}
              value={draft.load.durationSeconds}
              onChange={(e) => setLoad({ durationSeconds: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            Pipelining
            <input
              type="number"
              min={1}
              value={draft.load.pipelining}
              onChange={(e) => setLoad({ pipelining: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            Rate cap (req/s, optional)
            <input
              type="number"
              min={1}
              value={draft.load.rate ?? ''}
              placeholder="unlimited"
              onChange={(e) =>
                setLoad({ rate: e.target.value === '' ? undefined : Number(e.target.value) })
              }
            />
          </label>
        </div>
      </div>

      <div className="card">
        <h2>Request</h2>
        {headers.map(([k, v], i) => (
          <div className="header-row" key={i}>
            <input
              value={k}
              placeholder="Header"
              onChange={(e) => {
                const next = { ...draft.target.headers }
                delete next[k]
                next[e.target.value] = v
                setTarget({ headers: next })
              }}
            />
            <input
              value={v}
              placeholder="Value"
              onChange={(e) => {
                const next = { ...draft.target.headers, [k]: e.target.value }
                setTarget({ headers: next })
              }}
            />
            <button
              onClick={() => {
                const next = { ...draft.target.headers }
                delete next[k]
                setTarget({ headers: next })
              }}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          onClick={() => setTarget({ headers: { ...draft.target.headers, '': '' } })}
          disabled={headers.some(([k]) => k === '')}
        >
          + Add Header
        </button>
        <label className="field" style={{ marginTop: 12 }}>
          Body
          <textarea
            rows={3}
            value={draft.target.body ?? ''}
            placeholder="Optional request body"
            onChange={(e) => setTarget({ body: e.target.value })}
          />
        </label>
      </div>

      <div className="card">
        <h2>Engine</h2>
        <label className="field" style={{ maxWidth: 220 }}>
          Engine
          <select value={draft.engine} disabled>
            <option value="autocannon">Autocannon</option>
          </select>
        </label>
      </div>

      {error && <p className="error">{error}</p>}
      {!v.ok && (
        <p className="error">
          {v.errors.map((e) => (
            <span key={e}>
              • {e}
              <br />
            </span>
          ))}
        </p>
      )}

      <button className="primary grow" style={{ width: '100%' }} onClick={() => void start()} disabled={!v.ok || starting}>
        {starting ? 'Starting…' : 'Start Test'}
      </button>

      {confirm && (
        <div className="modal-backdrop">
          <div className="modal">
            <p style={{ whiteSpace: 'pre-line' }}>{confirm.warning}</p>
            <div className="actions">
              <button onClick={() => setConfirm(null)}>Cancel</button>
              <button className="primary" onClick={() => { setConfirm(null); void doStart() }}>
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}