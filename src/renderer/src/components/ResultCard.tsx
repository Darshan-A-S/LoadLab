import { fmtNum, fmtMs, fmtBytes, fmtPct, fmtTotalBytes } from '../format'
import type { TestResult } from '@shared/types'

interface Props {
  result: TestResult
  status: string
  onRunAgain: () => void
  onCompare?: () => void
}

export default function ResultCard({ result, status, onRunAgain, onCompare }: Props): JSX.Element {
  const l = result.latency
  const s = result.summary
  const codes = Object.entries(result.statusCodes ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
  return (
    <div>
      <div className="headerbar">
        <h1 style={{ margin: 0 }}>Test {status === 'stopped' ? 'Stopped' : 'Complete'}</h1>
      </div>
      <div className="card">
        <div className="section-label">Performance</div>
        <div className="grid-3">
          <Stat label="Requests" value={fmtNum(result.requests)} />
          <Stat label="Requests/sec" value={fmtNum(result.requestsPerSecond)} />
          <Stat label="Throughput" value={fmtBytes(result.throughput)} />
          <Stat label="Errors" value={fmtNum(result.errors)} />
          <Stat label="Timeouts" value={fmtNum(result.timeouts)} />
          <Stat label="Error Rate" value={fmtPct(result.errorRate)} />
          <Stat label="Data Transferred" value={fmtTotalBytes(result.dataTransferred)} />
          <Stat label="Duration" value={`${result.durationSec}s`} />
        </div>

        <div className="section-label">Latency</div>
        <div className="grid-3">
          <Stat label="Avg" value={fmtMs(l.average)} />
          <Stat label="Min" value={fmtMs(l.min)} />
          <Stat label="Max" value={fmtMs(l.max)} />
          <Stat label="Std Dev" value={fmtMs(l.stddev)} />
          <Stat label="Jitter (p99−p50)" value={fmtMs(s?.latencyJitter ?? 0)} />
        </div>

        <div className="section-label">Latency Percentiles</div>
        <div className="grid-3">
          <Stat label="p50" value={fmtMs(l.p50)} />
          <Stat label="p90" value={fmtMs(l.p90)} />
          <Stat label="p95" value={fmtMs(l.p95)} />
          <Stat label="p99" value={fmtMs(l.p99)} />
        </div>

        <div className="section-label">Summary</div>
        <div className="grid-3">
          <Stat label="Avg RPS" value={fmtNum(s?.avgRps ?? 0)} />
          <Stat label="Peak RPS" value={fmtNum(s?.peakRps ?? 0)} />
          <Stat label="Min RPS" value={fmtNum(s?.minRps ?? 0)} />
          <Stat label="Avg Throughput" value={fmtBytes(s?.avgThroughput ?? 0)} />
          <Stat label="Peak Throughput" value={fmtBytes(s?.peakThroughput ?? 0)} />
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
        {onCompare && (
          <button onClick={onCompare} title="Compare this run against another run">
            Compare...
          </button>
        )}
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