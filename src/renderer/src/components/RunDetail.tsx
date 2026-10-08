import { useState, useEffect } from 'react'
import {
  Clock,
  Download,
  ArrowLeftRight,
  Play,
  Globe,
  AlertCircle
} from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts'
import { fmtNum, fmtMs, fmtBytes, fmtPct, fmtTotalBytes, fmtTime } from '../format'
import type { HistoryEntry, TimeSeriesSample } from '@shared/types'
import TagSelector from './TagSelector'

interface Props {
  run: HistoryEntry
  onCompare?: (run: HistoryEntry) => void
  onOpenInEditor?: (run: HistoryEntry) => void
  onTagsChange?: (tags: string[]) => void
}

export default function RunDetail({
  run,
  onCompare,
  onOpenInEditor,
  onTagsChange
}: Props): JSX.Element {
  const [tags, setTags] = useState<string[]>(run.tags || [])

  useEffect(() => {
    setTags(run.tags || [])
  }, [run.tags])

  const handleTagsChange = (newTags: string[]): void => {
    const single = newTags.slice(0, 1)
    setTags(single)
    if (run.runId) {
      void window.loadlab.runs.updateTags(run.runId, single)
    }
    onTagsChange?.(single)
  }

  const r = run.result

  if (!r) {
    return (
      <div className="run-detail-container">
        <div className="run-detail-headerbar">
          <div className="run-detail-title-group">
            <div className="run-detail-title-row">
              <h1 className="run-detail-title">{run.name || 'Untitled Test'}</h1>
              <span className="run-id-chip">#{run.runId}</span>
              <span className={`run-status-pill status-${run.status}`}>
                <span className={`status-dot dot-${run.status === 'completed' ? 'ok' : 'bad'}`} />
                {run.status}
              </span>
              <span className="run-engine-pill">{run.engine}</span>
              <TagSelector tags={tags} onChange={handleTagsChange} align="left" />
            </div>
            <div className="run-detail-meta-row">
              <span className="run-meta-item">
                <Clock size={12} />
                {fmtTime(run.startedAt)}
              </span>
            </div>
          </div>

          <div className="run-detail-actions">
            {onOpenInEditor && (
              <button
                className="run-detail-btn"
                title="Open this test configuration in editor"
                onClick={() => onOpenInEditor(run)}
              >
                <Play size={12} />
                Open in Editor
              </button>
            )}
          </div>
        </div>

        <div className="run-target-banner">
          <Globe size={13} className="run-target-icon" />
          <span className="run-target-url">{run.target}</span>
        </div>

        <div className="card" style={{ padding: '32px 20px', textAlign: 'center' }}>
          <AlertCircle size={24} style={{ color: 'var(--muted)', marginBottom: 8 }} />
          <p className="empty" style={{ margin: 0 }}>
            No result recorded for this run ({run.status}).
          </p>
        </div>
      </div>
    )
  }

  const l = r.latency
  const s = r.summary
  const codes = Object.entries(r.statusCodes ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  return (
    <div className="run-detail-container">
      {/* Header Bar */}
      <div className="run-detail-headerbar">
        <div className="run-detail-title-group">
          <div className="run-detail-title-row">
            <h1 className="run-detail-title" title={run.name}>
              {run.name || 'Untitled Test'}
            </h1>
            <span className="run-id-chip">#{run.runId}</span>
            <span className={`run-status-pill status-${run.status}`}>
              <span className={`status-dot dot-${run.status === 'completed' ? 'ok' : run.status === 'stopped' ? 'warn' : 'bad'}`} />
              {run.status}
            </span>
            <span className="run-engine-pill">{run.engine}</span>
            <TagSelector tags={tags} onChange={handleTagsChange} align="left" />
          </div>
          <div className="run-detail-meta-row">
            <span className="run-meta-item">
              <Clock size={12} />
              {fmtTime(run.startedAt)}
            </span>
            <span className="run-meta-item">
              Duration: <strong>{r.durationSec}s</strong>
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="run-detail-actions">
          {onOpenInEditor && (
            <button
              className="run-detail-btn"
              title="Open this test configuration in editor"
              onClick={() => onOpenInEditor(run)}
            >
              <Play size={12} />
              Open in Editor
            </button>
          )}
          {onCompare && (
            <button
              className="run-detail-btn"
              title="Compare this run against another run"
              onClick={() => onCompare(run)}
            >
              <ArrowLeftRight size={12} />
              Compare
            </button>
          )}
          <button
            className="run-detail-btn"
            title="Export full test result as JSON"
            onClick={() => void window.loadlab.runs.export(r.runId, 'json')}
          >
            <Download size={12} />
            JSON
          </button>
          <button
            className="run-detail-btn"
            title="Export summary metrics as CSV"
            onClick={() => void window.loadlab.runs.export(r.runId, 'csv')}
          >
            <Download size={12} />
            CSV
          </button>
        </div>
      </div>

      {/* Target URL Banner */}
      <div className="run-target-banner">
        <Globe size={13} className="run-target-icon" />
        <span className="run-target-url">{run.target}</span>
      </div>

      {/* Main Stats Card */}
      <div className="card run-stats-card">
        <div className="section-label" style={{ marginTop: 4 }}>Performance Overview</div>
        <div className="grid-3">
          <Stat label="Total Requests" value={fmtNum(r.requests)} />
          <Stat label="Requests/sec" value={fmtNum(r.requestsPerSecond)} />
          <Stat label="Throughput" value={fmtBytes(r.throughput)} />
          <Stat label="Errors" value={fmtNum(r.errors)} highlight={r.errors > 0 ? 'bad' : 'ok'} />
          <Stat label="Timeouts" value={fmtNum(r.timeouts)} highlight={r.timeouts > 0 ? 'warn' : undefined} />
          <Stat label="Error Rate" value={fmtPct(r.errorRate ?? 0)} highlight={(r.errorRate ?? 0) > 0 ? 'bad' : 'ok'} />
          <Stat label="Data Transferred" value={fmtTotalBytes(r.dataTransferred ?? 0)} />
        </div>

        <div className="section-label">Latency Breakdown</div>
        <div className="grid-3">
          <Stat label="Average" value={fmtMs(l.average)} />
          <Stat label="Minimum" value={fmtMs(l.min ?? 0)} />
          <Stat label="Maximum" value={fmtMs(l.max ?? 0)} />
          <Stat label="Std Deviation" value={fmtMs(l.stddev ?? 0)} />
          <Stat label="Jitter (p99−p50)" value={fmtMs(s?.latencyJitter ?? 0)} />
        </div>

        <div className="section-label">Latency Percentiles</div>
        <div className="grid-3">
          <Stat label="p50 (Median)" value={fmtMs(l.p50)} />
          <Stat label="p90" value={fmtMs(l.p90)} />
          <Stat label="p95" value={fmtMs(l.p95)} />
          <Stat label="p99" value={fmtMs(l.p99)} />
        </div>

        <div className="section-label">Throughput & RPS Stability</div>
        <div className="grid-3">
          <Stat label="Avg RPS" value={fmtNum(s?.avgRps ?? 0)} />
          <Stat label="Peak RPS" value={fmtNum(s?.peakRps ?? 0)} />
          <Stat label="Min RPS" value={fmtNum(s?.minRps ?? 0)} />
          <Stat label="Avg Throughput" value={fmtBytes(s?.avgThroughput ?? 0)} />
          <Stat label="Peak Throughput" value={fmtBytes(s?.peakThroughput ?? 0)} />
        </div>

        {codes.length > 0 && (
          <>
            <div className="section-label">HTTP Status Codes</div>
            <div className="statusline">
              {codes.map(([code, count]) => (
                <span
                  key={code}
                  className={
                    code.startsWith('2') ? 'ok' : code.startsWith('3') ? 'warn' : 'bad'
                  }
                >
                  {code}: {fmtNum(count)}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Interactive Time Series Charts */}
      {r.timeSeries && r.timeSeries.length > 0 && (
        <div className="card run-charts-card">
          <div className="section-label" style={{ marginTop: 4 }}>Metrics Over Time</div>
          <Chart title="Requests / sec over time" dataKey="rps" color="#5b8cff" samples={r.timeSeries} unit="" />
          <Chart title="Latency over time (ms)" dataKey="latency" color="#35d6a6" samples={r.timeSeries} unit=" ms" />
          <Chart title="Errors over time" dataKey="errors" color="#ff5d6c" samples={r.timeSeries} unit="" />
        </div>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  highlight
}: {
  label: string
  value: string
  highlight?: 'ok' | 'bad' | 'warn'
}): JSX.Element {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className={`value ${highlight ? `val-${highlight}` : ''}`}>{value}</div>
    </div>
  )
}

function Chart({
  title,
  dataKey,
  color,
  samples,
  unit
}: {
  title: string
  dataKey: keyof TimeSeriesSample
  color: string
  samples: TimeSeriesSample[]
  unit: string
}): JSX.Element {
  return (
    <div className="chart">
      <div className="chart-title">{title}</div>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={samples} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid stroke="#2a3052" strokeDasharray="3 3" />
          <XAxis dataKey="t" stroke="#9aa1c0" tick={{ fontSize: 11 }} />
          <YAxis stroke="#9aa1c0" tick={{ fontSize: 11 }} width={50} />
          <Tooltip
            contentStyle={{ background: '#1e2340', border: '1px solid #2a3052', borderRadius: 8 }}
            labelStyle={{ color: '#9aa1c0' }}
            formatter={(v: number | string) => `${v}${unit}`}
            labelFormatter={(v: number | string) => `${v}s`}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            dot={false}
            isAnimationActive={false}
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}