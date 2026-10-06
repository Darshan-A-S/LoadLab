import { spawn, type ChildProcess } from 'node:child_process'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import type { TestDefinition, TestResult, TimeSeriesSample } from '../../shared/types'

function findBinary(name: string): string {
  const exeName = process.platform === 'win32' ? `${name}.exe` : name
  const cwdBin = join(process.cwd(), 'bin', exeName)
  if (existsSync(cwdBin)) return cwdBin

  if (typeof process !== 'undefined' && 'resourcesPath' in process && process.resourcesPath) {
    const resBin = join(process.resourcesPath, 'bin', exeName)
    if (existsSync(resBin)) return resBin
  }

  const pathEnv = process.env.PATH || ''
  const delimiter = process.platform === 'win32' ? ';' : ':'
  const pathDirs = pathEnv.split(delimiter)
  for (const dir of pathDirs) {
    if (!dir) continue
    const candidate = join(dir, exeName)
    if (existsSync(candidate)) return candidate
  }
  return exeName
}

function isBinaryAvailable(name: string): boolean {
  const resolved = findBinary(name)
  if (existsSync(resolved)) return true
  const exeName = process.platform === 'win32' ? `${name}.exe` : name
  const pathEnv = process.env.PATH || ''
  const delimiter = process.platform === 'win32' ? ';' : ':'
  return pathEnv.split(delimiter).some((dir) => dir && existsSync(join(dir, exeName)))
}

export interface EngineStartCallbacks {
  onSample: (sample: TimeSeriesSample) => void
  onDone: (err: Error | null, result: TestResult) => void
}

interface ActiveProcess {
  child: ChildProcess
}

const activeProcesses = new Map<number, ActiveProcess>()

export function validate(config: TestDefinition): string[] {
  const errors: string[] = []
  if (!isBinaryAvailable('oha')) {
    errors.push("Engine 'oha' binary not found. Place 'oha.exe' in the bin/ folder or install it on PATH.")
  }
  if (config.load.connections > 10000) {
    errors.push('oha supports at most 10000 concurrent connections')
  }
  return errors
}

export function isRunning(runId: number): boolean {
  return activeProcesses.has(runId)
}

interface OhaOutput {
  summary?: {
    total?: number
    requestsPerSec?: number
    sizePerSec?: number
    totalData?: number
    average?: number
  }
  metrics?: {
    requests_per_sec?: number
    latency_ms?: {
      mean?: number
      p50?: number
      p90?: number
      p95?: number
      p99?: number
    }
  }
  latencyPercentiles?: {
    p50?: number
    p90?: number
    p95?: number
    p99?: number
  }
  statusCodeDistribution?: Record<string, number>
  errorDistribution?: Record<string, number>
}

export function start(config: TestDefinition, runId: number, cb: EngineStartCallbacks): void {
  const binPath = findBinary('oha')
  const startedAt = Date.now()
  const durationSec = Math.max(1, Math.round(Number(config.load.durationSeconds) || 15))
  const connections = Math.max(1, Math.round(Number(config.load.connections) || 10))

  const args: string[] = [
    '-z', `${durationSec}s`,
    '-c', String(connections),
    '-m', config.target.method,
    '--no-tui',
    '--output-format', 'json'
  ]

  if (config.load.rate && config.load.rate > 0) {
    args.push('-q', String(config.load.rate))
  }

  // Headers
  if (config.target.headers) {
    for (const [k, v] of Object.entries(config.target.headers)) {
      if (k.trim()) args.push('-H', `${k.trim()}: ${v}`)
    }
  }

  // Auth
  if (config.target.auth) {
    if (config.target.auth.type === 'bearer' && config.target.auth.token) {
      args.push('-H', `Authorization: Bearer ${config.target.auth.token}`)
    } else if (config.target.auth.type === 'basic') {
      const u = config.target.auth.username ?? ''
      const p = config.target.auth.password ?? ''
      args.push('-a', `${u}:${p}`)
    }
  }

  // Body
  if (config.target.body) {
    args.push('-d', config.target.body)
  }

  // Target URL
  args.push(config.target.url)

  let stdout = ''
  let stderr = ''
  let child: ChildProcess

  try {
    child = spawn(binPath, args, { stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (err) {
    cb.onDone(err instanceof Error ? err : new Error(String(err)), null as unknown as TestResult)
    return
  }

  activeProcesses.set(runId, { child })

  child.stdout?.on('data', (chunk: Buffer) => {
    stdout += chunk.toString('utf8')
  })

  child.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString('utf8')
  })

  child.on('error', (err) => {
    activeProcesses.delete(runId)
    cb.onDone(err, null as unknown as TestResult)
  })

  child.on('close', (code) => {
    activeProcesses.delete(runId)

    if (code !== 0 && !stdout.trim()) {
      cb.onDone(new Error(stderr.trim() || `oha exited with code ${code}`), null as unknown as TestResult)
      return
    }

    try {
      const raw = JSON.parse(stdout) as OhaOutput
      const finishedAt = new Date().toISOString()
      const actualDurationSec = raw.summary?.total ? Math.round(raw.summary.total) : durationSec

      const statusCodes: Record<string, number> = {}
      let totalRequests = 0
      let non2xxErrors = 0

      if (raw.statusCodeDistribution) {
        for (const [codeStr, count] of Object.entries(raw.statusCodeDistribution)) {
          statusCodes[codeStr] = count
          totalRequests += count
          if (!codeStr.startsWith('2')) non2xxErrors += count
        }
      }

      if (totalRequests === 0 && raw.summary?.requestsPerSec) {
        totalRequests = Math.round(raw.summary.requestsPerSec * actualDurationSec)
      }

      let timeoutErrors = 0
      let extraErrors = 0
      if (raw.errorDistribution) {
        for (const [errMsg, count] of Object.entries(raw.errorDistribution)) {
          if (errMsg.toLowerCase().includes('deadline') || errMsg.toLowerCase().includes('timeout')) {
            timeoutErrors += count
          } else {
            extraErrors += count
          }
        }
      }

      const totalErrors = non2xxErrors + extraErrors

      const avgLat = Math.round(
        raw.metrics?.latency_ms?.mean ?? (raw.summary?.average ? raw.summary.average * 1000 : 0)
      )
      const p50 = Math.round(
        raw.metrics?.latency_ms?.p50 ?? (raw.latencyPercentiles?.p50 ? raw.latencyPercentiles.p50 * 1000 : avgLat)
      ) || avgLat
      const p90 = Math.round(
        raw.latencyPercentiles?.p90 ? raw.latencyPercentiles.p90 * 1000 : p50
      ) || p50
      const p95 = Math.round(
        raw.metrics?.latency_ms?.p95 ?? (raw.latencyPercentiles?.p95 ? raw.latencyPercentiles.p95 * 1000 : p90)
      ) || p90
      const p99 = Math.round(
        raw.metrics?.latency_ms?.p99 ?? (raw.latencyPercentiles?.p99 ? raw.latencyPercentiles.p99 * 1000 : p95)
      ) || p95

      const rps = Math.round(raw.summary?.requestsPerSec ?? (actualDurationSec > 0 ? totalRequests / actualDurationSec : totalRequests))
      const throughput = Math.round(raw.summary?.sizePerSec ?? 0)

      // Synthesize smooth sample points for the charts
      const timeSeries: TimeSeriesSample[] = []
      const stepCount = Math.max(1, actualDurationSec)
      for (let sec = 1; sec <= stepCount; sec++) {
        timeSeries.push({
          t: sec,
          rps,
          latency: p50,
          errors: Math.round(totalErrors / stepCount),
          throughput,
          totalRequests: Math.round((totalRequests / stepCount) * sec),
          totalErrors: Math.round((totalErrors / stepCount) * sec)
        })
      }

      const errorRate = totalRequests > 0 ? Math.round((totalErrors / totalRequests) * 10000) / 100 : 0
      const dataTransferred = raw.summary?.totalData ?? (throughput * actualDurationSec)
      const summary = {
        avgRps: rps,
        peakRps: rps,
        minRps: rps,
        avgThroughput: throughput,
        peakThroughput: throughput,
        latencyJitter: p99 - p50
      }

      const result: TestResult = {
        runId,
        engine: 'oha',
        startedAt: new Date(startedAt).toISOString(),
        finishedAt,
        durationSec: actualDurationSec,
        requests: totalRequests,
        requestsPerSecond: rps,
        throughput,
        latency: {
          min: p50,
          max: p99,
          average: avgLat,
          p50,
          p90,
          p95,
          p99,
          stddev: 0
        },
        errors: totalErrors,
        errorRate,
        timeouts: timeoutErrors,
        statusCodes,
        dataTransferred,
        summary,
        timeSeries
      }

      cb.onDone(null, result)
    } catch (parseErr) {
      cb.onDone(
        new Error(`Failed to parse oha output: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`),
        null as unknown as TestResult
      )
    }
  })
}

export function stop(runId: number): void {
  const active = activeProcesses.get(runId)
  if (!active) return

  if (active.child.pid) {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', active.child.pid.toString(), '/T', '/F'])
    } else {
      active.child.kill('SIGTERM')
    }
  }
  activeProcesses.delete(runId)
}
