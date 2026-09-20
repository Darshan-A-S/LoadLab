import type { TestResult } from '../shared/types'

export function renderJSON(result: TestResult): string {
  return JSON.stringify(result, null, 2)
}

export function renderCSV(result: TestResult): string {
  const r = result
  const header = [
    'runId',
    'startedAt',
    'finishedAt',
    'durationSec',
    'requests',
    'requestsPerSecond',
    'throughput',
    'avgLatencyMs',
    'p50Ms',
    'p90Ms',
    'p95Ms',
    'p99Ms',
    'errors',
    'timeouts',
    'statusCodes'
  ]
  const cells = [
    r.runId,
    r.startedAt,
    r.finishedAt,
    r.durationSec,
    r.requests,
    r.requestsPerSecond,
    r.throughput,
    r.latency.average,
    r.latency.p50,
    r.latency.p90,
    r.latency.p95,
    r.latency.p99,
    r.errors,
    r.timeouts,
    Object.entries(r.statusCodes ?? {})
      .map(([c, n]) => `${c}:${n}`)
      .join(' ')
  ]
  const rows = [header, cells].map((row) => row.map((v) => String(v)).join(','))
  if (r.timeSeries?.length) {
    rows.push('')
    rows.push('t, rps, latencyMs, errors, throughput')
    for (const s of r.timeSeries) rows.push(`${s.t}, ${s.rps}, ${s.latency}, ${s.errors}, ${s.throughput}`)
  }
  return rows.join('\n')
}