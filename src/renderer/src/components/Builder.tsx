import { useMemo, useState } from 'react'
import { validate, safetyWarnings } from '@shared/validation'
import { ENGINE_DEFAULTS, type TestDefinition, type HttpMethod, type EngineType } from '@shared/types'
import RequestEditor from './RequestEditor'

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: '#4fbb87',
  POST: '#f2994a',
  PUT: '#2f80ed',
  PATCH: '#9b51e0',
  DELETE: '#eb5757'
}

interface Props {
  draft: TestDefinition
  onChange: (d: TestDefinition | ((prev: TestDefinition) => TestDefinition)) => void
  error: string | null
  onStarted: (runId: number) => void
  onError: (msg: string | null) => void
  onSave: () => void
}

export default function Builder({ draft, onChange, error, onStarted, onError, onSave }: Props): JSX.Element {
  const [confirm, setConfirm] = useState<{ warning: string } | null>(null)
  const [starting, setStarting] = useState(false)

  const v = useMemo(() => validate(draft), [draft])
  const safety = useMemo(() => safetyWarnings(draft), [draft])

  const set = (patch: Partial<TestDefinition> | ((prev: TestDefinition) => TestDefinition)): void => {
    onChange((prev) => (typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }))
  }
  const setLoad = (patch: Partial<TestDefinition['load']>): void =>
    set((prev) => ({ ...prev, load: { ...prev.load, ...patch } }))
  const setTarget = (patch: Partial<TestDefinition['target']>): void =>
    set((prev) => ({ ...prev, target: { ...prev.target, ...patch } }))

  const handleEngineChange = (newEngine: EngineType): void => {
    const curDef = ENGINE_DEFAULTS[draft.engine] ?? ENGINE_DEFAULTS.autocannon
    const isAtCurrentDefaults =
      draft.load.connections === curDef.connections &&
      draft.load.durationSeconds === curDef.durationSeconds &&
      draft.load.pipelining === curDef.pipelining &&
      draft.load.rate === curDef.rate

    const newDef = ENGINE_DEFAULTS[newEngine] ?? ENGINE_DEFAULTS.autocannon
    if (isAtCurrentDefaults) {
      set({
        engine: newEngine,
        load: { ...newDef }
      })
    } else {
      set({ engine: newEngine })
    }
  }

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
      const runDraft = { ...draft, name: draft.name.trim() || 'Untitled Test' }
      const runId = await window.loadlab.runs.start(runDraft)
      onStarted(runId)
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    } finally {
      setStarting(false)
    }
  }

  return (
    <div>
      <div className="headerbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, marginRight: 12 }}>
          <input
            className="test-name-header-input"
            value={draft.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Untitled Test (enter test name...)"
          />
        </div>
        <button onClick={onSave} title="Save test to a collection">
          Save Test
        </button>
      </div>

      <div className="reqbar">
        <MethodSelect value={draft.target.method} onChange={(m) => setTarget({ method: m })} />
        <input
          className="url"
          value={draft.target.url}
          onChange={(e) => setTarget({ url: e.target.value })}
          placeholder="http://localhost:3000/api/users"
          spellCheck={false}
        />
        <button className="primary" onClick={() => void start()} disabled={!v.ok || starting}>
          {starting ? 'Starting…' : 'Start'}
        </button>
      </div>

      <RequestEditor
        url={draft.target.url}
        onUrlChange={(url) => setTarget({ url })}
        headers={draft.target.headers ?? {}}
        onHeadersChange={(headers) => setTarget({ headers })}
        body={draft.target.body ?? ''}
        onBodyChange={(body) => setTarget({ body })}
        auth={draft.target.auth}
        onAuthChange={(auth) => setTarget({ auth })}
        load={draft.load}
        onLoadChange={setLoad}
        engine={draft.engine}
        onEngineChange={handleEngineChange}
      />

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

function MethodSelect({ value, onChange }: { value: HttpMethod; onChange: (m: HttpMethod) => void }): JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <div className="msel" style={{ position: 'relative' }}>
      <button
        type="button"
        className="msel-btn"
        style={{ color: METHOD_COLORS[value] }}
        onClick={() => setOpen((o) => !o)}
      >
        {value}
        <svg width="9" height="9" viewBox="0 0 9 9">
          <path d="M1 3l3.5 3L8 3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <>
          <div className="msel-backdrop" onClick={() => setOpen(false)} />
          <div className="msel-menu">
            {METHODS.map((m) => (
              <button
                key={m}
                className={m === value ? 'active' : ''}
                style={{ color: METHOD_COLORS[m] }}
                onClick={() => {
                  onChange(m)
                  setOpen(false)
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}