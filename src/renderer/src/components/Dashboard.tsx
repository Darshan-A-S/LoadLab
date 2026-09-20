import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'
import { fmtMs, fmtBytes, fmtNum } from '../format'
import type { TimeSeriesSample } from '@shared/types'

interface Props {
  runId: number
  samples: TimeSeriesSample[]
  onStop: () => void
}

export default function Dashboard({ runId, samples, onStop }: Props): JSX.Element {
  const last = samples[samples.length - 1]
  const elapsed = last?.t ?? 0

  return (
    <div>
      <div className="headerbar">
        <h1 style={{ margin: 0 }}>Running Test</h1>
        <button className="danger" onClick={onStop}>
          Stop Test
        </button>
      </div>
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
      <p className="muted">Run #{runId}</p>
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