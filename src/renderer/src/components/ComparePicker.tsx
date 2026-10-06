import { useState, useMemo } from 'react'
import { Search, X, ArrowRight, Zap, AlertCircle } from 'lucide-react'
import { fmtNum, fmtMs, fmtPct, fmtTime } from '../format'
import type { HistoryEntry } from '@shared/types'
import TagBadge from './TagBadge'

interface Props {
  currentRun: HistoryEntry
  runs: HistoryEntry[]
  onSelect: (targetRun: HistoryEntry) => void
  onClose: () => void
}

export default function ComparePicker({
  currentRun,
  runs,
  onSelect,
  onClose
}: Props): JSX.Element {
  const [query, setQuery] = useState('')

  // Candidate runs: completed runs with valid results, excluding current run
  const candidates = useMemo(() => {
    return runs.filter(
      (r) => r.runId !== currentRun.runId && r.status === 'completed' && r.result !== null
    )
  }, [runs, currentRun.runId])

  // Filter and split into recommended and others
  const { recommended, others } = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = candidates.filter((r) => {
      if (!q) return true
      return (
        r.name.toLowerCase().includes(q) ||
        r.target.toLowerCase().includes(q) ||
        r.engine.toLowerCase().includes(q) ||
        String(r.runId).includes(q) ||
        r.tags?.some((t) => t.toLowerCase().includes(q))
      )
    })

    const rec: HistoryEntry[] = []
    const oth: HistoryEntry[] = []

    for (const r of filtered) {
      const sameTarget = r.target.toLowerCase() === currentRun.target.toLowerCase()
      const sameName = r.name.toLowerCase() === currentRun.name.toLowerCase()
      if (sameTarget || sameName) {
        rec.push(r)
      } else {
        oth.push(r)
      }
    }

    return { recommended: rec, others: oth }
  }, [candidates, query, currentRun])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-compare-picker" onClick={(e) => e.stopPropagation()}>
        <div className="compare-picker-header">
          <div>
            <h2 style={{ margin: 0, fontSize: 16 }}>Select Test to Compare</h2>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
              Comparing against <strong>{currentRun.name}</strong> (#{currentRun.runId})
            </p>
          </div>
          <button className="icon-btn" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>

        <div className="compare-search-box">
          <Search size={14} className="search-icon" />
          <input
            autoFocus
            type="text"
            placeholder="Search by test name, target URL, engine, or #ID..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className="clear-btn" onClick={() => setQuery('')}>
              <X size={12} />
            </button>
          )}
        </div>

        <div className="compare-picker-list">
          {candidates.length === 0 ? (
            <div className="picker-empty">
              <AlertCircle size={28} className="muted" />
              <p>No other completed test runs available to compare against.</p>
              <span className="muted" style={{ fontSize: 12 }}>
                Run another test to enable side-by-side comparison.
              </span>
            </div>
          ) : recommended.length === 0 && others.length === 0 ? (
            <div className="picker-empty">
              <p>No test runs matched &quot;{query}&quot;</p>
            </div>
          ) : (
            <>
              {recommended.length > 0 && (
                <div className="picker-group">
                  <div className="picker-group-title">
                    <Zap size={13} className="accent" />
                    Recommended Matches (Same Target or Name)
                  </div>
                  {recommended.map((r) => (
                    <RunCandidateCard
                      key={r.runId}
                      run={r}
                      onSelect={() => onSelect(r)}
                    />
                  ))}
                </div>
              )}

              {others.length > 0 && (
                <div className="picker-group">
                  <div className="picker-group-title">Other Test Runs</div>
                  {others.map((r) => (
                    <RunCandidateCard
                      key={r.runId}
                      run={r}
                      onSelect={() => onSelect(r)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="actions" style={{ marginTop: 12 }}>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

function RunCandidateCard({
  run,
  onSelect
}: {
  run: HistoryEntry
  onSelect: () => void
}): JSX.Element {
  const res = run.result
  return (
    <div className="candidate-card" onClick={onSelect}>
      <div className="candidate-main">
        <div className="candidate-top">
          <span className="candidate-name">{run.name}</span>
          <span className="candidate-id">#{run.runId}</span>
          <span className="candidate-engine">{run.engine}</span>
          {run.tags && run.tags.length > 0 && (
            <div className="candidate-tags">
              {run.tags.map((t) => (
                <TagBadge key={t} tag={t} size="sm" />
              ))}
            </div>
          )}
        </div>
        <div className="candidate-target" title={run.target}>
          {run.target}
        </div>
        <div className="candidate-meta">
          <span>{fmtTime(run.startedAt)}</span>
          {res && (
            <>
              <span>•</span>
              <span>{res.durationSec}s duration</span>
            </>
          )}
        </div>
      </div>

      {res && (
        <div className="candidate-stats">
          <div className="candidate-stat">
            <span className="stat-num">{fmtNum(res.requestsPerSecond)}</span>
            <span className="stat-lbl">req/s</span>
          </div>
          <div className="candidate-stat">
            <span className="stat-num">{fmtMs(res.latency.average)}</span>
            <span className="stat-lbl">avg</span>
          </div>
          <div className="candidate-stat">
            <span className="stat-num">{fmtMs(res.latency.p95)}</span>
            <span className="stat-lbl">p95</span>
          </div>
          <div className="candidate-stat">
            <span className="stat-num">{fmtPct(res.errorRate ?? 0)}</span>
            <span className="stat-lbl">errors</span>
          </div>
        </div>
      )}

      <button className="primary select-btn" onClick={onSelect}>
        <span>Compare</span>
        <ArrowRight size={13} />
      </button>
    </div>
  )
}
