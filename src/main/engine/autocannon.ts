import autocannon from 'autocannon'
import type { TestDefinition, TestResult, TimeSeriesSample } from '../../shared/types'

export interface EngineStartCallbacks {
  onSample: (sample: TimeSeriesSample) => void
  onDone: (err: Error | null, result: TestResult) => void
}

interface Holding {
  instance: autocannon.Instance
  startedAt: number
}

const holding = new Map<number, Holding>()

const RESERVOIR_CAP = 1024
const SAMPLE_EVERY = 2

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.floor(p * (sorted.length - 1))
  return Math.round(sorted[Math.max(0, Math.min(idx, sorted.length - 1))])
}

export function validate(config: TestDefinition): string[] {
  const errors: string[] = []
  if (config.load.connections > 10000) errors.push('Autocannon supports at most 10000 connections')
  return errors
}

export function isRunning(runId: number): boolean {
  return holding.has(runId)
}

interface RunState {
  totalRequests: number
  totalErrors: number
  reqCount: number
  lastTickAt: number
  reservoir: number[]
  samples: TimeSeriesSample[]
}

function sampleFor(state: RunState, startedAt: number, rps: number, throughput: number): TimeSeriesSample {
  const sorted = [...state.reservoir].sort((a, b) => a - b)
  return {
    t: Math.round((Date.now() - startedAt) / 1000),
    rps,
    latency: percentile(sorted, 0.5),
    errors: 0,
    throughput,
    totalRequests: state.totalRequests,
    totalErrors: state.totalErrors
  }
}

export function start(config: TestDefinition, runId: number, cb: EngineStartCallbacks): void {
  const opts: autocannon.Options = {
    url: config.target.url,
    method: config.target.method,
    headers: config.target.headers ?? {},
    body: config.target.body || undefined,
    connections: config.load.connections,
    duration: config.load.durationSeconds,
    pipelining: config.load.pipelining
  }
  if (config.load.rate && config.load.rate > 0) opts.rate = config.load.rate

  const startedAt = Date.now()
  const state: RunState = {
    totalRequests: 0,
    totalErrors: 0,
    reqCount: 0,
    lastTickAt: startedAt,
    reservoir: [],
    samples: []
  }
  const snapshot = (): TimeSeriesSample =>
    sampleFor(state, startedAt, 0, 0)

  const instance = autocannon(opts, (err, raw) => {
    holding.delete(runId)
    if (err) {
      cb.onDone(err, null as unknown as TestResult)
      return
    }
    const r = raw as {
      duration?: number
      totalRequests?: number
      requests?: { total?: number; average?: number }
      throughput?: { average?: number }
      latency?: { average?: number; p50?: number; p90?: number; p95?: number; p99?: number }
      errors?: number
      timeouts?: number
      non2xx?: number
      statusCodeStats?: Record<string, { count: number }>
    }
    const statusCodes: Record<string, number> = {}
    if (r.statusCodeStats) {
      for (const [code, info] of Object.entries(r.statusCodeStats)) statusCodes[code] = info.count
    }
    const final = snapshot()
    const avgLat = final.latency || Math.round(r.latency?.average ?? 0)
    cb.onDone(null, {
      runId,
      engine: 'autocannon',
      startedAt: new Date(startedAt).toISOString(),
      finishedAt: new Date().toISOString(),
      durationSec: r.duration ? Math.round(r.duration) : config.load.durationSeconds,
      requests: r.totalRequests ?? state.totalRequests,
      requestsPerSecond: Math.round(r.requests?.average ?? 0),
      throughput: r.throughput?.average ?? 0,
      latency: {
        average: avgLat,
        p50: Math.round(r.latency?.p50 ?? 0) || avgLat,
        p90: Math.round(r.latency?.p90 ?? 0) || avgLat,
        p95: Math.round(r.latency?.p95 ?? r.latency?.p90 ?? 0) || avgLat,
        p99: Math.round(r.latency?.p99 ?? 0) || avgLat
      },
      errors: (r.non2xx ?? 0) + (r.errors ?? 0),
      timeouts: r.timeouts ?? 0,
      statusCodes,
      timeSeries: state.samples
    })
  })

  instance.on('response', (_client: unknown, statusCode: unknown, _bytes: unknown, responseTime: number) => {
    if (!String(statusCode).startsWith('2')) state.totalErrors++
    state.reqCount++
    if (state.reqCount % SAMPLE_EVERY !== 0) return
    state.reservoir.push(responseTime)
    if (state.reservoir.length > RESERVOIR_CAP) state.reservoir.splice(0, state.reservoir.length - RESERVOIR_CAP)
  })

  instance.on('reqError', () => {
    state.totalErrors++
  })

  instance.on('tick', ({ counter, bytes }: { counter: number; bytes: number }) => {
    state.totalRequests += counter ?? 0
    const now = Date.now()
    const dt = (now - state.lastTickAt) / 1000
    state.lastTickAt = now
    const sample = sampleFor(state, startedAt, dt > 0 ? Math.round((counter ?? 0) / dt) : counter ?? 0, bytes ?? 0)
    state.samples.push(sample)
    cb.onSample(sample)
  })

  holding.set(runId, { instance, startedAt })
}

export function stop(runId: number): void {
  const h = holding.get(runId)
  if (h) h.instance.stop()
}