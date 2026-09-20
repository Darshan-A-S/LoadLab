import { fmtNum, fmtMs, fmtBytes } from '../format'
import type { TestResult } from '@shared/types'

interface Props {
  result: TestResult
  status: string
  onRunAgain: () => void
}

export default function ResultCard({ result, status, onRunAgain }: Props): JSX.Element {
  const l = result.latency
  const codes = Object.entries(result.statusCodes ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
  return (
    <div>
      <div className="headerbar">
        <h1 style={{ margin: 0 }}>Test {status === 'stopped' ? 'Stopped' : 'Complete'}</h1>
      </div>
      <div className="card">
        <div className="grid-3">
          <Stat label="Requests" value={fmtNum(result.requests)} />
          <Stat label="Requests/sec" value={fmtNum(result.requestsPerSecond)} />
          <Stat label="Throughput" value={fmtBytes(result.throughput)} />
          <Stat label="Avg latency" value={fmtMs(l.average)} />
          <Stat label="p50" value={fmtMs(l.p50)} />
          <Stat label="p90" value={fmtMs(l.p90)} />
          <Stat label="p95" value={fmtMs(l.p95)} />
          <Stat label="p99" value={fmtMs(l.p99)} />
          <Stat label="Errors" value={fmtNum(result.errors)} />
          <Stat label="Timeouts" value={fmtNum(result.timeouts)} />
          <Stat label="Duration" value={`${result.durationSec}s`} />
        </div>
        {codes.length > 0 && (
          <div className="statusline">
            {codes.map(([code, count]) => (
              <span key={code} className={code.startsWith('2') ? 'ok' : 'bad'}>
                {code}: {fmtNum(count)}
              </span>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="primary" onClick={onRunAgain}>
          Run Again
        </button>
        <button onClick={() => void window.loadlab.runs.export(result.runId, 'json')}>Export JSON</button>
        <button onClick={() => void window.loadlab.runs.export(result.runId, 'csv')}>Export CSV</button>
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