import { useState, useEffect } from 'react'
import { fmtNum, fmtMs, fmtBytes, fmtPct, fmtTotalBytes } from '../format'
import type { HistoryEntry } from '@shared/types'
import TagSelector from './TagSelector'

export default function RunDetail({
  run,
  onCompare,
  onTagsChange
}: {
  run: HistoryEntry
  onCompare?: (run: HistoryEntry) => void
  onTagsChange?: (tags: string[]) => void
}): JSX.Element {
  const [tags, setTags] = useState<string[]>(run.tags || [])

  useEffect(() => {
    setTags(run.tags || [])
  }, [run.tags])

  const handleTagsChange = (newTags: string[]): void => {
    setTags(newTags)
    if (run.runId) {
      void window.loadlab.runs.updateTags(run.runId, newTags)
    }
    onTagsChange?.(newTags)
  }

  const r = run.result
  if (!r) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h2 style={{ margin: 0 }}>{run.name}</h2>
          <TagSelector tags={tags} onChange={handleTagsChange} />
        </div>
        <p className="muted" style={{ wordBreak: 'break-all' }}>
          {run.target}
        </p>
        <p className="empty">No result recorded for this run.</p>
      </div>
    )
  }
  const l = r.latency
  const s = r.summary
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h2 style={{ margin: 0 }}>
          {run.name} <span className="muted">(#{run.runId})</span>
        </h2>
        <TagSelector tags={tags} onChange={handleTagsChange} />
      </div>
      <p className="muted" style={{ wordBreak: 'break-all' }}>
        {run.target}
      </p>

      <div className="section-label">Performance</div>
      <div className="grid-3">
        <Stat label="Requests" value={fmtNum(r.requests)} />
        <Stat label="Requests/sec" value={fmtNum(r.requestsPerSecond)} />
        <Stat label="Throughput" value={`${fmtNum(r.throughput)} B/s`} />
        <Stat label="Errors" value={fmtNum(r.errors)} />
        <Stat label="Timeouts" value={fmtNum(r.timeouts)} />
        <Stat label="Error Rate" value={fmtPct(r.errorRate ?? 0)} />
        <Stat label="Data Transferred" value={fmtTotalBytes(r.dataTransferred ?? 0)} />
      </div>

      <div className="section-label">Latency</div>
      <div className="grid-3">
        <Stat label="Avg" value={fmtMs(l.average)} />
        <Stat label="Min" value={fmtMs(l.min ?? 0)} />
        <Stat label="Max" value={fmtMs(l.max ?? 0)} />
        <Stat label="Std Dev" value={fmtMs(l.stddev ?? 0)} />
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
        {onCompare && (
          <button className="primary" onClick={() => onCompare(run)} title="Compare this run against another run">
            Compare...
          </button>
        )}
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