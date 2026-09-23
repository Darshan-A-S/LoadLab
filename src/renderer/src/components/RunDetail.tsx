import { fmtNum, fmtMs } from '../format'
import type { HistoryEntry } from '@shared/types'

export default function RunDetail({ run }: { run: HistoryEntry }): JSX.Element {
  const r = run.result
  if (!r) {
    return (
      <div>
        <h2>{run.name}</h2>
        <p className="muted" style={{ wordBreak: 'break-all' }}>
          {run.target}
        </p>
        <p className="empty">No result recorded for this run.</p>
      </div>
    )
  }
  const l = r.latency
  return (
    <div>
      <h2>
        {run.name} <span className="muted">(#{run.runId})</span>
      </h2>
      <p className="muted" style={{ wordBreak: 'break-all' }}>
        {run.target}
      </p>
      <div className="grid-3">
        <Stat label="Requests" value={fmtNum(r.requests)} />
        <Stat label="Requests/sec" value={fmtNum(r.requestsPerSecond)} />
        <Stat label="Throughput" value={`${fmtNum(r.throughput)} B/s`} />
        <Stat label="Avg latency" value={fmtMs(l.average)} />
        <Stat label="p50" value={fmtMs(l.p50)} />
        <Stat label="p90" value={fmtMs(l.p90)} />
        <Stat label="p95" value={fmtMs(l.p95)} />
        <Stat label="p99" value={fmtMs(l.p99)} />
        <Stat label="Errors" value={fmtNum(r.errors)} />
        <Stat label="Timeouts" value={fmtNum(r.timeouts)} />
      </div>
      {Object.keys(r.statusCodes ?? {}).length > 0 && (
        <div className="statusline">
          {Object.entries(r.statusCodes!)
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
        <button onClick={() => void window.loadlab.runs.export(r.runId, 'json')}>Export JSON</button>
        <button onClick={() => void window.loadlab.runs.export(r.runId, 'csv')}>Export CSV</button>
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