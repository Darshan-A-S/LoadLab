import { useState, useMemo } from 'react'
import {
  ArrowLeftRight,
  Download,
  Copy,
  Check,
  X,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import { fmtNum, fmtMs, fmtBytes, fmtPct, fmtTotalBytes, fmtTime } from '../format'
import type { HistoryEntry, TestResult } from '@shared/types'
import TagBadge from './TagBadge'

interface Props {
  runA: HistoryEntry
  runB: HistoryEntry
  allRuns: HistoryEntry[]
  onSwap: () => void
  onChangeRunA: (run: HistoryEntry) => void
  onChangeRunB: (run: HistoryEntry) => void
  onClose: () => void
}

type BetterDirection = 'higher' | 'lower' | 'neutral'

interface MetricRowDef {
  label: string
  valA: number
  valB: number
  formattedA: string
  formattedB: string
  better: BetterDirection
  unit?: string
  isPercentDelta?: boolean
}

export default function CompareRuns({
  runA,
  runB,
  allRuns,
  onSwap,
  onChangeRunA,
  onChangeRunB,
  onClose
}: Props): JSX.Element {
  const [activeChart, setActiveChart] = useState<'latency' | 'rps'>('latency')
  const [copied, setCopied] = useState(false)

  const resA = runA.result as TestResult
  const resB = runB.result as TestResult

  // Parity / Apples-to-Apples warnings
  const warnings = useMemo(() => {
    const list: string[] = []
    if (resA && resB) {
      if (runA.engine !== runB.engine) {
        list.push(`Different Engines: ${runA.engine} vs ${runB.engine}`)
      }
      if (resA.durationSec !== resB.durationSec) {
        list.push(
          `Different Durations: ${resA.durationSec}s vs ${resB.durationSec}s (Total requests will reflect time difference)`
        )
      }
      if (runA.target.toLowerCase() !== runB.target.toLowerCase()) {
        list.push('Different Target URLs: Compare results represent distinct endpoints')
      }
    }
    return list
  }, [runA, runB, resA, resB])

  // Completed candidate runs for quick dropdown switching
  const completedRuns = useMemo(() => {
    return allRuns.filter((r) => r.status === 'completed' && r.result !== null)
  }, [allRuns])

  // Performance & Reliability Rows
  const perfRows = useMemo<MetricRowDef[]>(() => {
    if (!resA || !resB) return []
    return [
      {
        label: 'Requests/sec (RPS)',
        valA: resA.requestsPerSecond,
        valB: resB.requestsPerSecond,
        formattedA: `${fmtNum(resA.requestsPerSecond)} req/s`,
        formattedB: `${fmtNum(resB.requestsPerSecond)} req/s`,
        better: 'higher'
      },
      {
        label: 'Throughput',
        valA: resA.throughput,
        valB: resB.throughput,
        formattedA: fmtBytes(resA.throughput),
        formattedB: fmtBytes(resB.throughput),
        better: 'higher'
      },
      {
        label: 'Error Rate',
        valA: resA.errorRate ?? 0,
        valB: resB.errorRate ?? 0,
        formattedA: fmtPct(resA.errorRate ?? 0),
        formattedB: fmtPct(resB.errorRate ?? 0),
        better: 'lower',
        isPercentDelta: true
      },
      {
        label: 'Errors',
        valA: resA.errors,
        valB: resB.errors,
        formattedA: fmtNum(resA.errors),
        formattedB: fmtNum(resB.errors),
        better: 'lower'
      },
      {
        label: 'Timeouts',
        valA: resA.timeouts,
        valB: resB.timeouts,
        formattedA: fmtNum(resA.timeouts),
        formattedB: fmtNum(resB.timeouts),
        better: 'lower'
      },
      {
        label: 'Total Requests',
        valA: resA.requests,
        valB: resB.requests,
        formattedA: fmtNum(resA.requests),
        formattedB: fmtNum(resB.requests),
        better: 'neutral'
      },
      {
        label: 'Data Transferred',
        valA: resA.dataTransferred ?? 0,
        valB: resB.dataTransferred ?? 0,
        formattedA: fmtTotalBytes(resA.dataTransferred ?? 0),
        formattedB: fmtTotalBytes(resB.dataTransferred ?? 0),
        better: 'neutral'
      },
      {
        label: 'Duration',
        valA: resA.durationSec,
        valB: resB.durationSec,
        formattedA: `${resA.durationSec}s`,
        formattedB: `${resB.durationSec}s`,
        better: 'neutral'
      }
    ]
  }, [resA, resB])

  // Latency Rows
  const latencyRows = useMemo<MetricRowDef[]>(() => {
    if (!resA || !resB) return []
    const lA = resA.latency
    const lB = resB.latency
    const sA = resA.summary
    const sB = resB.summary

    return [
      {
        label: 'Avg Latency',
        valA: lA.average,
        valB: lB.average,
        formattedA: fmtMs(lA.average),
        formattedB: fmtMs(lB.average),
        better: 'lower'
      },
      {
        label: 'Min Latency',
        valA: lA.min ?? 0,
        valB: lB.min ?? 0,
        formattedA: fmtMs(lA.min ?? 0),
        formattedB: fmtMs(lB.min ?? 0),
        better: 'lower'
      },
      {
        label: 'Max Latency',
        valA: lA.max ?? 0,
        valB: lB.max ?? 0,
        formattedA: fmtMs(lA.max ?? 0),
        formattedB: fmtMs(lB.max ?? 0),
        better: 'lower'
      },
      {
        label: 'Std Dev',
        valA: lA.stddev ?? 0,
        valB: lB.stddev ?? 0,
        formattedA: fmtMs(lA.stddev ?? 0),
        formattedB: fmtMs(lB.stddev ?? 0),
        better: 'lower'
      },
      {
        label: 'Latency Jitter (p99−p50)',
        valA: sA?.latencyJitter ?? 0,
        valB: sB?.latencyJitter ?? 0,
        formattedA: fmtMs(sA?.latencyJitter ?? 0),
        formattedB: fmtMs(sB?.latencyJitter ?? 0),
        better: 'lower'
      }
    ]
  }, [resA, resB])

  // Percentiles Rows
  const percentileRows = useMemo<MetricRowDef[]>(() => {
    if (!resA || !resB) return []
    const lA = resA.latency
    const lB = resB.latency
    return [
      {
        label: 'p50 (Median)',
        valA: lA.p50,
        valB: lB.p50,
        formattedA: fmtMs(lA.p50),
        formattedB: fmtMs(lB.p50),
        better: 'lower'
      },
      {
        label: 'p90',
        valA: lA.p90,
        valB: lB.p90,
        formattedA: fmtMs(lA.p90),
        formattedB: fmtMs(lB.p90),
        better: 'lower'
      },
      {
        label: 'p95',
        valA: lA.p95,
        valB: lB.p95,
        formattedA: fmtMs(lA.p95),
        formattedB: fmtMs(lB.p95),
        better: 'lower'
      },
      {
        label: 'p99',
        valA: lA.p99,
        valB: lB.p99,
        formattedA: fmtMs(lA.p99),
        formattedB: fmtMs(lB.p99),
        better: 'lower'
      }
    ]
  }, [resA, resB])

  // Peaks & Extremes Rows
  const peakRows = useMemo<MetricRowDef[]>(() => {
    if (!resA || !resB) return []
    const sA = resA.summary
    const sB = resB.summary
    return [
      {
        label: 'Avg RPS',
        valA: sA?.avgRps ?? 0,
        valB: sB?.avgRps ?? 0,
        formattedA: `${fmtNum(sA?.avgRps ?? 0)} req/s`,
        formattedB: `${fmtNum(sB?.avgRps ?? 0)} req/s`,
        better: 'higher'
      },
      {
        label: 'Peak RPS',
        valA: sA?.peakRps ?? 0,
        valB: sB?.peakRps ?? 0,
        formattedA: `${fmtNum(sA?.peakRps ?? 0)} req/s`,
        formattedB: `${fmtNum(sB?.peakRps ?? 0)} req/s`,
        better: 'higher'
      },
      {
        label: 'Min RPS',
        valA: sA?.minRps ?? 0,
        valB: sB?.minRps ?? 0,
        formattedA: `${fmtNum(sA?.minRps ?? 0)} req/s`,
        formattedB: `${fmtNum(sB?.minRps ?? 0)} req/s`,
        better: 'higher'
      },
      {
        label: 'Avg Throughput',
        valA: sA?.avgThroughput ?? 0,
        valB: sB?.avgThroughput ?? 0,
        formattedA: fmtBytes(sA?.avgThroughput ?? 0),
        formattedB: fmtBytes(sB?.avgThroughput ?? 0),
        better: 'higher'
      },
      {
        label: 'Peak Throughput',
        valA: sA?.peakThroughput ?? 0,
        valB: sB?.peakThroughput ?? 0,
        formattedA: fmtBytes(sA?.peakThroughput ?? 0),
        formattedB: fmtBytes(sB?.peakThroughput ?? 0),
        better: 'higher'
      }
    ]
  }, [resA, resB])

  // Unified Status Codes list
  const statusCodes = useMemo(() => {
    if (!resA || !resB) return []
    const keys = Array.from(
      new Set([...Object.keys(resA.statusCodes ?? {}), ...Object.keys(resB.statusCodes ?? {})])
    ).sort()

    return keys.map((code) => {
      const countA = resA.statusCodes?.[code] ?? 0
      const countB = resB.statusCodes?.[code] ?? 0
      const pctA = resA.requests > 0 ? (countA / resA.requests) * 100 : 0
      const pctB = resB.requests > 0 ? (countB / resB.requests) * 100 : 0
      return {
        code,
        countA,
        countB,
        pctA,
        pctB
      }
    })
  }, [resA, resB])

  // Merged TimeSeries for Dual-line Overlay Chart
  const mergedTimeline = useMemo(() => {
    if (!resA?.timeSeries || !resB?.timeSeries) return []
    const map = new Map<
      number,
      { t: number; rpsA?: number; latencyA?: number; rpsB?: number; latencyB?: number }
    >()

    for (const sample of resA.timeSeries) {
      map.set(sample.t, {
        t: sample.t,
        rpsA: sample.rps,
        latencyA: sample.latency
      })
    }

    for (const sample of resB.timeSeries) {
      const existing = map.get(sample.t) ?? { t: sample.t }
      existing.rpsB = sample.rps
      existing.latencyB = sample.latency
      map.set(sample.t, existing)
    }

    return Array.from(map.values()).sort((a, b) => a.t - b.t)
  }, [resA, resB])

  // Generate Markdown report
  const generateMarkdownReport = (): string => {
    const lines: string[] = []
    lines.push(`# LoadLab Comparison Report`)
    const tagsA = runA.tags && runA.tags.length ? ` [Tag: ${runA.tags[0]}]` : ''
    const tagsB = runB.tags && runB.tags.length ? ` [Tag: ${runB.tags[0]}]` : ''
    lines.push(
      `**Baseline (A)**: ${runA.name} (#${runA.runId}) - ${runA.target} (${runA.engine})${tagsA}`
    )
    lines.push(
      `**Target (B)**: ${runB.name} (#${runB.runId}) - ${runB.target} (${runB.engine})${tagsB}`
    )
    lines.push(`**Generated**: ${new Date().toLocaleString()}`)
    lines.push('')

    if (warnings.length > 0) {
      lines.push(`> ⚠️ **Notes**: ${warnings.join('; ')}`)
      lines.push('')
    }

    const appendSection = (title: string, rows: MetricRowDef[]): void => {
      lines.push(`### ${title}`)
      lines.push(`| Metric | Baseline (A) | Target (B) | Delta | Change |`)
      lines.push(`| :--- | :--- | :--- | :--- | :--- |`)
      for (const row of rows) {
        const delta = row.valB - row.valA
        const pct = row.valA > 0 ? ((row.valB - row.valA) / row.valA) * 100 : 0
        const pctStr = row.valA > 0 ? `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%` : '—'
        const deltaStr = `${delta >= 0 ? '+' : ''}${fmtNum(Math.round(delta))}`
        lines.push(`| ${row.label} | ${row.formattedA} | ${row.formattedB} | ${deltaStr} | ${pctStr} |`)
      }
      lines.push('')
    }

    appendSection('Performance & Reliability', perfRows)
    appendSection('Latency', latencyRows)
    appendSection('Latency Percentiles', percentileRows)
    appendSection('Summary Extremes', peakRows)

    if (statusCodes.length > 0) {
      lines.push(`### Status Codes Breakdown`)
      lines.push(`| Code | Baseline (A) Count (%) | Target (B) Count (%) | Delta |`)
      lines.push(`| :--- | :--- | :--- | :--- |`)
      for (const sc of statusCodes) {
        lines.push(
          `| ${sc.code} | ${fmtNum(sc.countA)} (${sc.pctA.toFixed(1)}%) | ${fmtNum(sc.countB)} (${sc.pctB.toFixed(1)}%) | ${sc.countB - sc.countA >= 0 ? '+' : ''}${fmtNum(sc.countB - sc.countA)} |`
        )
      }
      lines.push('')
    }

    return lines.join('\n')
  }

  // Copy report to clipboard
  const handleCopyReport = async (): Promise<void> => {
    try {
      const text = generateMarkdownReport()
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  // Download Markdown file
  const handleDownloadReport = (): void => {
    const text = generateMarkdownReport()
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `loadlab-comparison-run-${runA.runId}-vs-${runB.runId}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-compare" onClick={(e) => e.stopPropagation()}>
        {/* Header Bar */}
        <div className="compare-header">
          <div className="compare-title-block">
            <h1 style={{ margin: 0, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ArrowLeftRight size={18} className="accent" />
              Compare Test Results
            </h1>
            <p className="muted" style={{ margin: '3px 0 0', fontSize: 12 }}>
              Baseline (A) vs Target (B) performance and latency analysis
            </p>
          </div>

          <div className="compare-top-actions">
            <button className="compare-swap-btn" onClick={onSwap} title="Swap Baseline and Target">
              <ArrowLeftRight size={14} />
              <span>Swap (A ⇄ B)</span>
            </button>
            <button onClick={() => void handleCopyReport()} title="Copy Markdown Report">
              {copied ? <Check size={14} color="#35d6a6" /> : <Copy size={14} />}
              <span>{copied ? 'Copied!' : 'Copy Report'}</span>
            </button>
            <button onClick={handleDownloadReport} title="Download Markdown Summary">
              <Download size={14} />
              <span>Export .md</span>
            </button>
            <button className="icon-btn" onClick={onClose} title="Close comparison">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Configurations Header Card */}
        <div className="compare-configs-grid">
          <div className="compare-config-box baseline-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <div className="config-box-tag">Baseline (A)</div>
              {runA.tags && runA.tags.length > 0 && (
                <TagBadge tag={runA.tags[0]} size="sm" />
              )}
            </div>
            <div className="config-run-select">
              <select
                value={runA.runId}
                onChange={(e) => {
                  const target = completedRuns.find((r) => r.runId === Number(e.target.value))
                  if (target) onChangeRunA(target)
                }}
              >
                {completedRuns.map((r) => (
                  <option key={r.runId} value={r.runId}>
                    #{r.runId} - {r.name} ({r.engine})
                  </option>
                ))}
              </select>
            </div>
            <div className="config-url" title={runA.target}>
              {runA.target}
            </div>
            <div className="config-meta">
              <span>{runA.engine}</span>
              <span>•</span>
              <span>{resA?.durationSec}s duration</span>
              <span>•</span>
              <span>{fmtTime(runA.startedAt)}</span>
            </div>
          </div>

          <div className="compare-configs-mid">
            <button className="swap-mid-btn" onClick={onSwap} title="Swap Baseline and Target">
              <ArrowLeftRight size={16} />
            </button>
          </div>

          <div className="compare-config-box target-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <div className="config-box-tag">Target / Candidate (B)</div>
              {runB.tags && runB.tags.length > 0 && (
                <TagBadge tag={runB.tags[0]} size="sm" />
              )}
            </div>
            <div className="config-run-select">
              <select
                value={runB.runId}
                onChange={(e) => {
                  const target = completedRuns.find((r) => r.runId === Number(e.target.value))
                  if (target) onChangeRunB(target)
                }}
              >
                {completedRuns.map((r) => (
                  <option key={r.runId} value={r.runId}>
                    #{r.runId} - {r.name} ({r.engine})
                  </option>
                ))}
              </select>
            </div>
            <div className="config-url" title={runB.target}>
              {runB.target}
            </div>
            <div className="config-meta">
              <span>{runB.engine}</span>
              <span>•</span>
              <span>{resB?.durationSec}s duration</span>
              <span>•</span>
              <span>{fmtTime(runB.startedAt)}</span>
            </div>
          </div>
        </div>

        {/* Apples-to-Apples Warnings */}
        {warnings.length > 0 && (
          <div className="compare-warning-banner">
            <AlertTriangle size={15} className="warning-icon" />
            <div className="warning-content">
              <strong>Test Parameters Advisory:</strong> {warnings.join(' • ')}
            </div>
          </div>
        )}

        {/* Metrics Tables */}
        <div className="compare-tables-container">
          <CompareTableSection
            title="Performance & Reliability"
            rows={perfRows}
            nameA={runA.name}
            nameB={runB.name}
          />

          <CompareTableSection
            title="Latency"
            rows={latencyRows}
            nameA={runA.name}
            nameB={runB.name}
          />

          <CompareTableSection
            title="Latency Percentiles"
            rows={percentileRows}
            nameA={runA.name}
            nameB={runB.name}
          />

          <CompareTableSection
            title="Summary Extremes"
            rows={peakRows}
            nameA={runA.name}
            nameB={runB.name}
          />
        </div>

        {/* Status Codes Comparison */}
        {statusCodes.length > 0 && (
          <div className="compare-section-card">
            <div className="compare-section-title">Status Codes Distribution</div>
            <table className="compare-table">
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Status Code</th>
                  <th style={{ width: '25%' }}>Baseline (A)</th>
                  <th style={{ width: '25%' }}>Target (B)</th>
                  <th style={{ width: '25%' }}>Delta Count</th>
                </tr>
              </thead>
              <tbody>
                {statusCodes.map((sc) => {
                  const deltaCount = sc.countB - sc.countA
                  const isSuccess = sc.code.startsWith('2')
                  return (
                    <tr key={sc.code}>
                      <td style={{ fontWeight: 600 }}>
                        <span className={`status-code-badge ${isSuccess ? 'code-ok' : 'code-bad'}`}>
                          {sc.code}
                        </span>
                      </td>
                      <td>
                        {fmtNum(sc.countA)}{' '}
                        <span className="muted" style={{ fontSize: 11 }}>
                          ({sc.pctA.toFixed(1)}%)
                        </span>
                      </td>
                      <td>
                        {fmtNum(sc.countB)}{' '}
                        <span className="muted" style={{ fontSize: 11 }}>
                          ({sc.pctB.toFixed(1)}%)
                        </span>
                      </td>
                      <td>
                        <span
                          className={`diff-badge ${
                            deltaCount === 0
                              ? 'diff-badge-neutral'
                              : isSuccess
                              ? deltaCount > 0
                                ? 'diff-badge-better'
                                : 'diff-badge-worse'
                              : deltaCount < 0
                              ? 'diff-badge-better'
                              : 'diff-badge-worse'
                          }`}
                        >
                          {deltaCount >= 0 ? `+${fmtNum(deltaCount)}` : fmtNum(deltaCount)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Dual-line Overlaid Time-Series Charts */}
        {mergedTimeline.length > 0 && (
          <div className="compare-section-card">
            <div className="compare-chart-header">
              <div className="compare-section-title" style={{ margin: 0 }}>
                Timeline Overlay ({activeChart === 'latency' ? 'Latency (ms)' : 'Requests/sec (RPS)'})
              </div>
              <div className="compare-chart-tabs">
                <button
                  className={activeChart === 'latency' ? 'active' : ''}
                  onClick={() => setActiveChart('latency')}
                >
                  Latency (ms)
                </button>
                <button
                  className={activeChart === 'rps' ? 'active' : ''}
                  onClick={() => setActiveChart('rps')}
                >
                  RPS (req/s)
                </button>
              </div>
            </div>

            <div className="compare-chart-container">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={mergedTimeline} margin={{ top: 10, right: 15, bottom: 0, left: -10 }}>
                  <CartesianGrid stroke="#2a3052" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="t"
                    stroke="#9aa1c0"
                    tick={{ fontSize: 11 }}
                    unit="s"
                  />
                  <YAxis
                    stroke="#9aa1c0"
                    tick={{ fontSize: 11 }}
                    unit={activeChart === 'latency' ? 'ms' : ''}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#1e2340',
                      border: '1px solid #2a3052',
                      borderRadius: 8
                    }}
                    labelStyle={{ color: '#9aa1c0' }}
                    labelFormatter={(v) => `${v}s elapsed`}
                    formatter={(v, name) => [
                      activeChart === 'latency' ? fmtMs(Number(v)) : `${fmtNum(Number(v))} req/s`,
                      name === 'valA' ? `Baseline (A: #${runA.runId})` : `Target (B: #${runB.runId})`
                    ]}
                  />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    formatter={(val) =>
                      val === 'valA'
                        ? `Baseline (A: #${runA.runId} ${runA.name})`
                        : `Target (B: #${runB.runId} ${runB.name})`
                    }
                  />
                  <Line
                    type="monotone"
                    name="valA"
                    dataKey={activeChart === 'latency' ? 'latencyA' : 'rpsA'}
                    stroke="#5b8cff"
                    dot={false}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    name="valB"
                    dataKey={activeChart === 'latency' ? 'latencyB' : 'rpsB'}
                    stroke="#35d6a6"
                    dot={false}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="actions" style={{ marginTop: 16 }}>
          <button className="primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

function CompareTableSection({
  title,
  rows,
  nameA,
  nameB
}: {
  title: string
  rows: MetricRowDef[]
  nameA: string
  nameB: string
}): JSX.Element {
  return (
    <div className="compare-section-card">
      <div className="compare-section-title">{title}</div>
      <table className="compare-table">
        <thead>
          <tr>
            <th style={{ width: '32%' }}>Metric</th>
            <th style={{ width: '22%' }}>Baseline (A)</th>
            <th style={{ width: '22%' }}>Target (B)</th>
            <th style={{ width: '24%' }}>Difference / Delta</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <CompareTableRow key={row.label} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CompareTableRow({ row }: { row: MetricRowDef }): JSX.Element {
  const delta = row.valB - row.valA
  let pctChange = 0
  if (row.valA > 0) {
    pctChange = ((row.valB - row.valA) / row.valA) * 100
  }

  // Calculate improvement or regression
  let status: 'better' | 'worse' | 'neutral' = 'neutral'
  if (row.better === 'higher') {
    if (delta > 0) status = 'better'
    else if (delta < 0) status = 'worse'
  } else if (row.better === 'lower') {
    if (delta < 0) status = 'better'
    else if (delta > 0) status = 'worse'
  }

  const deltaFormatted = useMemo(() => {
    if (row.isPercentDelta) {
      const sign = delta >= 0 ? '+' : ''
      return `${sign}${delta.toFixed(2)}%`
    }
    const sign = delta >= 0 ? '+' : ''
    if (row.label.toLowerCase().includes('latency') || row.label.toLowerCase().includes('jitter') || row.label.toLowerCase().includes('std dev')) {
      return `${sign}${fmtMs(delta)}`
    }
    if (row.label.toLowerCase().includes('throughput')) {
      return `${sign}${fmtBytes(delta)}`
    }
    if (row.label.toLowerCase().includes('duration')) {
      return `${sign}${delta}s`
    }
    return `${sign}${fmtNum(Math.round(delta))}`
  }, [delta, row])

  return (
    <tr>
      <td className="metric-label-cell">{row.label}</td>
      <td className="val-a-cell">{row.formattedA}</td>
      <td className="val-b-cell">{row.formattedB}</td>
      <td className="delta-cell">
        <div className="delta-pill-wrap">
          <span className={`diff-badge diff-badge-${status}`}>
            {status === 'better' && <TrendingUp size={12} />}
            {status === 'worse' && <TrendingDown size={12} />}
            {status === 'neutral' && <Minus size={12} />}
            {row.valA > 0 ? (
              <span>
                {pctChange >= 0 ? '+' : ''}
                {pctChange.toFixed(1)}%
              </span>
            ) : (
              <span>{deltaFormatted}</span>
            )}
          </span>
          {row.valA > 0 && delta !== 0 && (
            <span className="delta-abs-muted">({deltaFormatted})</span>
          )}
        </div>
      </td>
    </tr>
  )
}
