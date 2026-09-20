import { useEffect, useState } from 'react'
import { fmtNum, fmtMs, fmtTime } from '../format'
import type { HistoryEntry } from '@shared/types'

export default function History(): JSX.Element {
  const [runs, setRuns] = useState<HistoryEntry[]>([])
  const [selected, setSelected] = useState<HistoryEntry | null>(null)

  useEffect(() => {
    window.loadlab.runs.list().then(setRuns)
  }, [])

  return (
    <div>
      <h1>History</h1>
      {runs.length === 0 ? (
        <p className="empty">No runs yet. Create a test to get started.</p>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Target</th>
                <th>Engine</th>
                <th>Status</th>
                <th>Started</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.runId}>
                  <td>{r.name}</td>
                  <td className="muted" style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.target}
                  </td>
                  <td>{r.engine}</td>
                  <td>
                    <span className={`badge ${r.status}`}>{r.status}</span>
                  </td>
                  <td className="muted">{fmtTime(r.startedAt)}</td>
                  <td>
                    {r.result ? (
                      <button onClick={() => setSelected(r)}>Details</button>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected?.result && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 640, maxHeight: '85vh', overflowY: 'auto' }}>
            <RunDetail run={selected} />
            <div className="actions">
              <button onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RunDetail({ run }: { run: HistoryEntry }): JSX.Element {
  const r = run.result
  const l = r!.latency
  return (
    <div>
      <h2>
        {run.name} <span className="muted">(#{run.runId})</span>
      </h2>
      <p className="muted" style={{ wordBreak: 'break-all' }}>
        {run.target}
      </p>
      <div className="grid-3">
        <Stat label="Requests" value={fmtNum(r!.requests)} />
        <Stat label="Requests/sec" value={fmtNum(r!.requestsPerSecond)} />
        <Stat label="Throughput" value={`${fmtNum(r!.throughput)} B/s`} />
        <Stat label="Avg latency" value={fmtMs(l.average)} />
        <Stat label="p50" value={fmtMs(l.p50)} />
        <Stat label="p90" value={fmtMs(l.p90)} />
        <Stat label="p95" value={fmtMs(l.p95)} />
        <Stat label="p99" value={fmtMs(l.p99)} />
        <Stat label="Errors" value={fmtNum(r!.errors)} />
        <Stat label="Timeouts" value={fmtNum(r!.timeouts)} />
      </div>
      {Object.keys(r!.statusCodes ?? {}).length > 0 && (
        <div className="statusline">
          {Object.entries(r!.statusCodes!)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([code, count]) => (
              <span key={code} className={code.startsWith('2') ? 'ok' : 'bad'}>
                {code}: {fmtNum(count)}
              </span>
            ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={() => void window.loadlab.runs.export(r!.runId, 'json')}>Export JSON</button>
        <button onClick={() => void window.loadlab.runs.export(r!.runId, 'csv')}>Export CSV</button>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  )
}