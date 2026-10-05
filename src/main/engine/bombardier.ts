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
  timer: NodeJS.Timeout
}

const activeProcesses = new Map<number, ActiveProcess>()

export function validate(config: TestDefinition): string[] {
  const errors: string[] = []
  if (!isBinaryAvailable('bombardier')) {
    errors.push("Engine 'bombardier' binary not found. Place 'bombardier.exe' in the bin/ folder or install it on PATH.")
  }
  if (config.load.connections > 20000) {
    errors.push('bombardier supports at most 20000 concurrent connections')
  }
  return errors
}

export function isRunning(runId: number): boolean {
  return activeProcesses.has(runId)
}

interface BombardierOutput {
  spec?: {
    numberOfConnections?: number
    testDurationSeconds?: number
    method?: string
    url?: string
  }
  result?: {
    bytesRead: number
    bytesWritten: number
    timeTakenSeconds: number
    req1xx?: number
    req2xx?: number
    req3xx?: number
    req4xx?: number
    req5xx?: number
    others?: number
    latency?: {
      mean?: number // in microseconds
      stddev?: number
      max?: number
      percentiles?: Record<string, number> // in microseconds
    }
    rps?: {
      mean?: number
      stddev?: number
      max?: number
      percentiles?: Record<string, number>
    }
  }
}

export function start(config: TestDefinition, runId: number, cb: EngineStartCallbacks): void {
  const binPath = findBinary('bombardier')
  const startedAt = Date.now()

  const args: string[] = [
    '-d', `${config.load.durationSeconds}s`,
    '-c', String(config.load.connections),
    '-m', config.target.method,
    '-l', // Collect latency statistics
    '-p', 'r', // Print result only
    '-o', 'json'
  ]

  if (config.load.rate && config.load.rate > 0) {
    args.push('-r', String(config.load.rate))
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
      const creds = Buffer.from(
        `${config.target.auth.username ?? ''}:${config.target.auth.password ?? ''}`
      ).toString('base64')
      args.push('-H', `Authorization: Basic ${creds}`)
    }
  }

  // Body
  if (config.target.body) {
    args.push('-b', config.target.body)
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

  const samples: TimeSeriesSample[] = []

  const timer = setInterval(() => {
    const elapsedSec = Math.round((Date.now() - startedAt) / 1000)
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

  activeProcesses.set(runId, { child, timer })

  child.stdout?.on('data', (chunk: Buffer) => {
    stdout += chunk.toString('utf8')
  })

  child.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString('utf8')
  })

  child.on('error', (err) => {
    clearInterval(timer)
    activeProcesses.delete(runId)
    cb.onDone(err, null as unknown as TestResult)
  })

  child.on('close', (code) => {
    clearInterval(timer)
    activeProcesses.delete(runId)

    if (code !== 0 && !stdout.trim()) {
      cb.onDone(new Error(stderr.trim() || `bombardier exited with code ${code}`), null as unknown as TestResult)
      return
    }

    try {
      const raw = JSON.parse(stdout) as BombardierOutput
      const finishedAt = new Date().toISOString()
      const durationSec = raw.result?.timeTakenSeconds ? Math.round(raw.result.timeTakenSeconds) : config.load.durationSeconds

      const totalRequests =
        (raw.result?.req1xx ?? 0) +
        (raw.result?.req2xx ?? 0) +
        (raw.result?.req3xx ?? 0) +
        (raw.result?.req4xx ?? 0) +
        (raw.result?.req5xx ?? 0) +
        (raw.result?.others ?? 0)

      const statusCodes: Record<string, number> = {}
      if (raw.result?.req1xx) statusCodes['1xx'] = raw.result.req1xx
      if (raw.result?.req2xx) {
        statusCodes['200'] = raw.result.req2xx
        statusCodes['2xx'] = raw.result.req2xx
      }
      if (raw.result?.req3xx) statusCodes['3xx'] = raw.result.req3xx
      if (raw.result?.req4xx) statusCodes['4xx'] = raw.result.req4xx
      if (raw.result?.req5xx) statusCodes['5xx'] = raw.result.req5xx
      if (raw.result?.others) statusCodes['other'] = raw.result.others

      const errors = (raw.result?.req4xx ?? 0) + (raw.result?.req5xx ?? 0) + (raw.result?.others ?? 0)

      // Convert microseconds to milliseconds
      const meanUs = raw.result?.latency?.mean ?? 0
      const avgLat = Math.round(meanUs / 1000)
      const p50 = Math.round((raw.result?.latency?.percentiles?.['50'] ?? meanUs) / 1000) || avgLat
      const p90 = Math.round((raw.result?.latency?.percentiles?.['90'] ?? meanUs) / 1000) || avgLat
      const p95 = Math.round((raw.result?.latency?.percentiles?.['95'] ?? meanUs) / 1000) || avgLat
      const p99 = Math.round((raw.result?.latency?.percentiles?.['99'] ?? meanUs) / 1000) || avgLat

      const rps = Math.round(raw.result?.rps?.mean ?? (durationSec > 0 ? totalRequests / durationSec : totalRequests))
      const throughput =
        raw.result?.timeTakenSeconds && raw.result.timeTakenSeconds > 0
          ? Math.round(raw.result.bytesRead / raw.result.timeTakenSeconds)
          : 0

      // Synthesize timeline samples for charts
      const timeSeries: TimeSeriesSample[] = []
      const stepCount = Math.max(1, durationSec)
      for (let sec = 1; sec <= stepCount; sec++) {
        timeSeries.push({
          t: sec,
          rps,
          latency: p50,
          errors: Math.round(errors / stepCount),
          throughput,
          totalRequests: Math.round((totalRequests / stepCount) * sec),
          totalErrors: Math.round((errors / stepCount) * sec)
        })
      }

      const result: TestResult = {
        runId,
        engine: 'bombardier',
        startedAt: new Date(startedAt).toISOString(),
        finishedAt,
        durationSec,
        requests: totalRequests,
        requestsPerSecond: rps,
        throughput,
        latency: {
          average: avgLat,
          p50,
          p90,
          p95,
          p99
        },
        errors,
        timeouts: 0,
        statusCodes,
        timeSeries
      }

      cb.onDone(null, result)
    } catch (parseErr) {
      cb.onDone(
        new Error(`Failed to parse bombardier output: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`),
        null as unknown as TestResult
      )
    }
  })
}

export function stop(runId: number): void {
  const active = activeProcesses.get(runId)
  if (!active) return

  clearInterval(active.timer)
  if (active.child.pid) {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', active.child.pid.toString(), '/T', '/F'])
    } else {
      active.child.kill('SIGTERM')
    }
  }
  activeProcesses.delete(runId)
}
