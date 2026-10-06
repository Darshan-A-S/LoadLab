import { useEffect, useState } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'
import { fmtMs, fmtBytes, fmtNum } from '../format'
import type { TimeSeriesSample } from '@shared/types'

interface Props {
  runId: number
  samples: TimeSeriesSample[]
  startedAt?: number
  engine?: string
  durationSec?: number
  targetUrl?: string
  connections?: number
  onStop: () => void
}

export default function Dashboard({
  runId,
  samples,
  startedAt,
  engine = 'autocannon',
  durationSec = 30,
  targetUrl,
  connections,
  onStop
}: Props): JSX.Element {
  // ONLY oha and bombardier run in native batch mode without per-second live socket callbacks
  const isNativeBatch = engine === 'oha' || engine === 'bombardier'

  // Live timer for accurate real-time seconds synchronization
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [])

  const totalDuration = Math.max(1, Number(durationSec) || 30)
  const startTime = startedAt && startedAt > 0 ? startedAt : (samples[0] ? Date.now() - samples[0].t * 1000 : now)
  const rawElapsed = Math.floor(Math.max(0, now - startTime) / 1000)

  // In native batch mode, clamp elapsed to totalDuration so it doesn't overshoot while the process exits
  const elapsed = isNativeBatch ? Math.min(totalDuration, rawElapsed) : (samples[samples.length - 1]?.t ?? rawElapsed)
  const progressPct = Math.min(100, Math.round((elapsed / totalDuration) * 100))
  const remainingSec = Math.max(0, totalDuration - elapsed)
  const isFinalizing = isNativeBatch && rawElapsed >= totalDuration

  const last = samples[samples.length - 1]

  return (
    <div>
      <div className="headerbar">
        <div>
          <h1 style={{ margin: 0 }}>Running Test</h1>
          {targetUrl && (
            <div className="muted" style={{ fontSize: 12, marginTop: 2, wordBreak: 'break-all' }}>
              {targetUrl}
            </div>
          )}
        </div>
        <button className="danger" onClick={onStop}>
          Stop Test
        </button>
      </div>

      {isNativeBatch ? (
        <div className="card" style={{ padding: 20 }}>
          <div className="batch-progress-header">
            <div className="batch-engine-pill">
              <span className="batch-engine-dot" />
              <span>{engine.toUpperCase()} Engine Running</span>
            </div>
            <span className="muted" style={{ fontSize: 12 }}>
              Run #{runId}
            </span>
          </div>

          <div className="grid-3" style={{ margin: '16px 0' }}>
            <Stat label="Elapsed" value={`${elapsed}s`} />
            <Stat label="Total Duration" value={`${totalDuration}s`} />
            <Stat label="Remaining" value={isFinalizing ? 'Finalizing...' : `${remainingSec}s`} />
            {connections ? <Stat label="Connections" value={fmtNum(connections)} /> : null}
            <Stat label="Progress" value={`${progressPct}%`} />
            <Stat label="Execution Mode" value="Native Binary" />
          </div>

          <div className="batch-progress-bar-wrap">
            <div className="batch-progress-bar-track">
              <div
                className="batch-progress-bar-fill"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="batch-progress-bar-labels">
              <span>0s</span>
              <span>
                {isFinalizing ? 'Finalizing & compiling results...' : `${progressPct}% completed (${elapsed}s / ${totalDuration}s)`}
              </span>
              <span>{totalDuration}s</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="grid-3">
            <Stat label="Elapsed" value={`${elapsed}s`} />
            <Stat label="Requests/sec" value={fmtNum(last?.rps ?? 0)} />
            <Stat label="Total requests" value={fmtNum(last?.totalRequests ?? 0)} />
            <Stat label="Avg latency" value={fmtMs(last?.latency ?? 0)} />
            <Stat label="Throughput" value={fmtBytes(last?.throughput ?? 0)} />
            <Stat label="Errors" value={fmtNum(last?.totalErrors ?? 0)} />
          </div>

          <Chart title="Requests/sec over time" dataKey="rps" color="#5b8cff" samples={samples} unit="" />
          <Chart title="Latency over time (ms)" dataKey="latency" color="#35d6a6" samples={samples} unit=" ms" />
          <Chart title="Errors over time" dataKey="errors" color="#ff5d6c" samples={samples} unit="" />
        </div>
      )}
      <p className="muted" style={{ marginTop: 8 }}>
        Run #{runId}
      </p>
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