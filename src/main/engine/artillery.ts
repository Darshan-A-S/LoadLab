import { spawn, type ChildProcess } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import type { TestDefinition, TestResult, TimeSeriesSample } from '../../shared/types'

export interface EngineStartCallbacks {
  onSample: (sample: TimeSeriesSample) => void
  onDone: (err: Error | null, result: TestResult) => void
}

interface ActiveProcess {
  process: ChildProcess
  scriptPath: string
  reportPath: string
  timer: NodeJS.Timeout
}

const activeProcesses = new Map<number, ActiveProcess>()

export function validate(config: TestDefinition): string[] {
  const errors: string[] = []
  if (config.load.connections > 10000) {
    errors.push('Artillery supports at most 10000 connections/arrivalRate')
  }
  return errors
}

export function isRunning(runId: number): boolean {
  return activeProcesses.has(runId)
}

export function start(config: TestDefinition, runId: number, cb: EngineStartCallbacks): void {
  const startedAt = Date.now()
  const tmpDir = os.tmpdir()
  const scriptPath = path.join(tmpDir, `loadlab-artillery-${runId}-${Date.now()}.json`)
  const reportPath = path.join(tmpDir, `loadlab-artillery-report-${runId}-${Date.now()}.json`)

  // Parse target URL into base origin and path
  let targetOrigin = config.target.url
  let requestPath = '/'
  try {
    const parsed = new URL(config.target.url)
    targetOrigin = parsed.origin
    requestPath = parsed.pathname + parsed.search
  } catch {
    // fallback if URL is relative
  }

  const arrivalRate = config.load.rate && config.load.rate > 0
    ? config.load.rate
    : Math.max(1, config.load.connections)

  const methodKey = config.target.method.toLowerCase()
  const requestConfig: Record<string, unknown> = {
    url: requestPath
  }

  if (config.target.headers && Object.keys(config.target.headers).length > 0) {
    requestConfig.headers = { ...config.target.headers }
  }

  if (config.target.body) {
    try {
      requestConfig.json = JSON.parse(config.target.body)
    } catch {
      requestConfig.body = config.target.body
    }
  }

  const artilleryConfig = {
    config: {
      target: targetOrigin,
      phases: [
        {
          duration: config.load.durationSeconds,
          arrivalRate,
          maxVusers: config.load.connections
        }
      ]
    },
    scenarios: [
      {
        flow: [
          {
            [methodKey]: requestConfig
          }
        ]
      }
    ]
  }

  try {
    fs.writeFileSync(scriptPath, JSON.stringify(artilleryConfig, null, 2), 'utf8')
  } catch (err) {
    cb.onDone(err instanceof Error ? err : new Error(String(err)), null as unknown as TestResult)
    return
  }

  const samples: TimeSeriesSample[] = []

  // Periodic sample ticker
  const timer = setInterval(() => {
    const now = Date.now()
    const elapsedSec = Math.round((now - startedAt) / 1000)
    const sample: TimeSeriesSample = {
      t: elapsedSec,
      rps: 0,
      latency: 0,
      errors: 0,
      throughput: 0,
      totalRequests: 0,
      totalErrors: 0
    }
    samples.push(sample)
    cb.onSample(sample)
  }, 1000)

  const artilleryBin = path.join(process.cwd(), 'node_modules', 'artillery', 'bin', 'run')
  const child = spawn(process.execPath, [artilleryBin, 'run', scriptPath, '--output', reportPath], {
    stdio: ['ignore', 'pipe', 'pipe']
  })

  activeProcesses.set(runId, {
    process: child,
    scriptPath,
    reportPath,
    timer
  })

  let stderr = ''
  child.stderr?.on('data', (chunk) => {
    stderr += chunk.toString()
  })

  const cleanupFiles = (): void => {
    try {
      if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath)
    } catch {
      // ignore cleanup errors
    }
    try {
      if (fs.existsSync(reportPath)) fs.unlinkSync(reportPath)
    } catch {
      // ignore cleanup errors
    }
  }

  child.on('close', (code) => {
    clearInterval(timer)
    activeProcesses.delete(runId)

    if (code !== 0 && !fs.existsSync(reportPath)) {
      cleanupFiles()
      cb.onDone(new Error(stderr.trim() || `Artillery exited with code ${code}`), null as unknown as TestResult)
      return
    }

    try {
      if (!fs.existsSync(reportPath)) {
        throw new Error('Artillery did not generate report file')
      }

      const raw = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
      const aggregate = raw.aggregate ?? {}
      const counters = aggregate.counters ?? {}
      const summaries = aggregate.summaries ?? {}
      const rates = aggregate.rates ?? {}

      const rtSummary = summaries['http.response_time'] ?? {}
      const statusCodes: Record<string, number> = {}
      let totalErrors = counters['vusers.failed'] ?? 0

      // Extract HTTP status code counters
      for (const [key, val] of Object.entries(counters)) {
        if (key.startsWith('http.codes.')) {
          const code = key.replace('http.codes.', '')
          const count = typeof val === 'number' ? val : 0
          statusCodes[code] = count
          if (parseInt(code, 10) >= 400) {
            totalErrors += count
          }
        }
      }

      const totalRequests = counters['http.requests'] ?? 0
      const durationSec = config.load.durationSeconds
      const rps = rates['http.request_rate'] ? Math.round(rates['http.request_rate']) : Math.round(totalRequests / Math.max(1, durationSec))
      const throughput = counters['http.downloaded_bytes'] ? Math.round(counters['http.downloaded_bytes'] / Math.max(1, durationSec)) : 0

      const avgLatency = Math.round(rtSummary.mean ?? 0)
      const p50 = Math.round(rtSummary.p50 ?? rtSummary.median ?? avgLatency)
      const p90 = Math.round(rtSummary.p90 ?? avgLatency)
      const p95 = Math.round(rtSummary.p95 ?? avgLatency)
      const p99 = Math.round(rtSummary.p99 ?? avgLatency)

      cleanupFiles()

      const result: TestResult = {
        runId,
        engine: 'artillery',
        startedAt: new Date(startedAt).toISOString(),
        finishedAt: new Date().toISOString(),
        durationSec,
        requests: totalRequests,
        requestsPerSecond: rps,
        throughput,
        latency: {
          average: avgLatency,
          p50,
          p90,
          p95,
          p99
        },
        errors: totalErrors,
        timeouts: counters['http.timeouts'] ?? 0,
        statusCodes,
        timeSeries: samples
      }

      cb.onDone(null, result)
    } catch (parseErr) {
      cleanupFiles()
      cb.onDone(new Error(`Failed to parse Artillery output: ${parseErr}`), null as unknown as TestResult)
    }
  })

  child.on('error', (err) => {
    clearInterval(timer)
    activeProcesses.delete(runId)
    cleanupFiles()
    cb.onDone(err, null as unknown as TestResult)
  })
}

export function stop(runId: number): void {
  const active = activeProcesses.get(runId)
  if (!active) return

  clearInterval(active.timer)
  const child = active.process

  if (process.platform === 'win32' && child.pid) {
    spawn('taskkill', ['/pid', child.pid.toString(), '/T', '/F'])
  } else {
    child.kill('SIGTERM')
  }

  activeProcesses.delete(runId)
}
