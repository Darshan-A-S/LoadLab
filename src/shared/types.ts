export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface TestDefinition {
  name: string
  target: {
    url: string
    method: HttpMethod
    headers?: Record<string, string>
    body?: string
  }
  load: {
    connections: number
    durationSeconds: number
    pipelining: number
    /** optional requests-per-second cap */
    rate?: number
  }
  engine: 'autocannon'
}

export interface RunStatus {
  runId: number
  scenarioId: number | null
  name: string
  target: string
  engine: string
  status: 'starting' | 'running' | 'completed' | 'stopped' | 'failed'
  startedAt: string
  finishedAt: string | null
  error?: string
}

export interface TimeSeriesSample {
  /** seconds since test start */
  t: number
  rps: number
  latency: number
  /** error count since previous sample */
  errors: number
  throughput: number
  totalRequests: number
  totalErrors: number
}

export interface TestResult {
  runId: number
  engine: string
  startedAt: string
  finishedAt: string
  durationSec: number
  requests: number
  requestsPerSecond: number
  throughput: number
  latency: {
    average: number
    p50: number
    p90: number
    p95: number
    p99: number
  }
  errors: number
  timeouts: number
  /** exact status code -> count, e.g. { "200": 160000, "401": 4000 } */
  statusCodes: Record<string, number>
  timeSeries: TimeSeriesSample[]
}

export interface Scenario {
  id: number
  name: string
  config: TestDefinition
  createdAt: string
}

export interface HistoryEntry {
  runId: number
  name: string
  target: string
  engine: string
  status: RunStatus['status']
  startedAt: string
  finishedAt: string | null
  result: TestResult | null
}

export type SampleEvent = {
  runId: number
  sample: TimeSeriesSample
}

export type ResultEvent = {
  runId: number
  status: RunStatus['status']
  error?: string
  result?: TestResult
}