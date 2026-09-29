import { loadTest } from 'loadtest'
// @ts-expect-error loadtest internal module lacks type declarations
import { Latency } from 'loadtest/lib/latency.js'
import type { TestDefinition, TestResult, TimeSeriesSample } from '../../shared/types'

export interface EngineStartCallbacks {
  onSample: (sample: TimeSeriesSample) => void
  onDone: (err: Error | null, result: TestResult) => void
}

interface ActiveRun {
  instance?: { stop: () => void }
  timer: NodeJS.Timeout
  startedAt: number
}

const activeRuns = new Map<number, ActiveRun>()

// Patch Latency.prototype.begin once to capture the LoadTest instance when a run starts
let isPatched = false
function ensurePatched(): void {
  if (isPatched) return
  isPatched = true

  const origBegin = Latency.prototype.begin
  Latency.prototype.begin = function (id: string) {
    const runId = this.options?.statusCallback?.runId as number | undefined
    if (runId !== undefined && this.loadTest) {
      const active = activeRuns.get(runId)
      if (active && !active.instance) {
        active.instance = this.loadTest
      }
    }
    return origBegin.call(this, id)
  }
}

const RESERVOIR_CAP = 1024

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.floor(p * (sorted.length - 1))
  return Math.round(sorted[Math.max(0, Math.min(idx, sorted.length - 1))])
}

export function validate(config: TestDefinition): string[] {
  const errors: string[] = []
  if (config.load.connections > 5000) {
    errors.push('loadtest supports at most 5000 concurrent clients')
  }
  return errors
}

export function isRunning(runId: number): boolean {
  return activeRuns.has(runId)
}

export function start(config: TestDefinition, runId: number, cb: EngineStartCallbacks): void {
  ensurePatched()

  const startedAt = Date.now()
  let totalRequests = 0
  let totalErrors = 0
  let lastSampleTime = startedAt
  let lastSampleRequests = 0
  let lastSampleBytes = 0
  let totalBytes = 0

  const reservoir: number[] = []
  const samples: TimeSeriesSample[] = []
  const statusCodes: Record<string, number> = {}

  interface StatusResult {
    requestElapsed?: number
    statusCode?: number
    body?: string
  }

  const statusCallback = (err: Error | null, result?: StatusResult): void => {
    totalRequests++

    const statusCode = result?.statusCode
    if (statusCode) {
      const codeStr = String(statusCode)
      statusCodes[codeStr] = (statusCodes[codeStr] || 0) + 1
      if (statusCode >= 400) {
        totalErrors++
      }
    } else if (err) {
      totalErrors++
    }

    if (result?.body) {
      const bytes = Buffer.byteLength(result.body)
      totalBytes += bytes
      lastSampleBytes += bytes
    }

    if (result?.requestElapsed !== undefined) {
      reservoir.push(result.requestElapsed)
      if (reservoir.length > RESERVOIR_CAP) {
        reservoir.splice(0, reservoir.length - RESERVOIR_CAP)
      }
    }
  }

  // Attach runId to callback so Latency.prototype.begin can associate the LoadTest instance
  statusCallback.runId = runId

  // Live sampling ticker every 1 second
  const timer = setInterval(() => {
    const now = Date.now()
    const dt = (now - lastSampleTime) / 1000
    const deltaReq = totalRequests - lastSampleRequests
    const rps = dt > 0 ? Math.round(deltaReq / dt) : deltaReq
    const throughput = dt > 0 ? Math.round(lastSampleBytes / dt) : lastSampleBytes

    lastSampleTime = now
    lastSampleRequests = totalRequests
    lastSampleBytes = 0

    const sorted = [...reservoir].sort((a, b) => a - b)
    const sample: TimeSeriesSample = {
      t: Math.round((now - startedAt) / 1000),
      rps,
      latency: percentile(sorted, 0.5),
      errors: totalErrors,
      throughput,
      totalRequests,
      totalErrors
    }

    samples.push(sample)
    cb.onSample(sample)
  }, 1000)

  activeRuns.set(runId, {
    timer,
    startedAt
  })

  const opts: Record<string, unknown> = {
    url: config.target.url,
    concurrency: config.load.connections,
    maxSeconds: config.load.durationSeconds,
    method: config.target.method,
    headers: config.target.headers ? { ...config.target.headers } : {},
    body: config.target.body || undefined,
    requestsPerSecond: config.load.rate && config.load.rate > 0 ? config.load.rate : undefined,
    quiet: true,
    statusCallback
  }

  interface LoadTestRawResult {
    totalRequests?: number
    totalErrors?: number
    rps?: number
    meanLatencyMs?: number
    percentiles?: Record<string, number>
    errorCodes?: Record<string, number>
    elapsedSeconds?: number
  }

  loadTest(opts, (err: Error | null, rawResult?: unknown) => {
    clearInterval(timer)
    activeRuns.delete(runId)

    if (err) {
      cb.onDone(err, null as unknown as TestResult)
      return
    }

    const raw = (rawResult ?? {}) as LoadTestRawResult
    const finishedAt = new Date().toISOString()
    const sorted = [...reservoir].sort((a, b) => a - b)

    // Merge error codes into statusCodes if present
    if (raw.errorCodes) {
      for (const [code, count] of Object.entries(raw.errorCodes)) {
        if (!statusCodes[code]) {
          statusCodes[code] = count
        }
      }
    }

    const testDuration = raw.elapsedSeconds ? Math.round(raw.elapsedSeconds) : config.load.durationSeconds
    const avgLatency = Math.round(raw.meanLatencyMs ?? (sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0))
    const p50 = raw.percentiles?.['50'] ? Math.round(raw.percentiles['50']) : percentile(sorted, 0.5)
    const p90 = raw.percentiles?.['90'] ? Math.round(raw.percentiles['90']) : percentile(sorted, 0.9)
    const p95 = raw.percentiles?.['95'] ? Math.round(raw.percentiles['95']) : percentile(sorted, 0.95)
    const p99 = raw.percentiles?.['99'] ? Math.round(raw.percentiles['99']) : percentile(sorted, 0.99)

    const finalResult: TestResult = {
      runId,
      engine: 'loadtest',
      startedAt: new Date(startedAt).toISOString(),
      finishedAt,
      durationSec: testDuration,
      requests: raw.totalRequests ?? totalRequests,
      requestsPerSecond: Math.round(raw.rps ?? (testDuration > 0 ? totalRequests / testDuration : totalRequests)),
      throughput: testDuration > 0 ? Math.round(totalBytes / testDuration) : 0,
      latency: {
        average: avgLatency,
        p50: p50 || avgLatency,
        p90: p90 || avgLatency,
        p95: p95 || avgLatency,
        p99: p99 || avgLatency
      },
      errors: raw.totalErrors ?? totalErrors,
      timeouts: 0,
      statusCodes,
      timeSeries: samples
    }

    cb.onDone(null, finalResult)
  })
}

export function stop(runId: number): void {
  const run = activeRuns.get(runId)
  if (run) {
    clearInterval(run.timer)
    if (run.instance) {
      run.instance.stop()
    }
    activeRuns.delete(runId)
  }
}
