import autocannon from 'autocannon'
// In TypeScript, "import type" imports only the type definitions (shapes of objects).
// These are used by TypeScript at compile-time for type checking and are completely removed
// from the compiled JavaScript, reducing bundle size and avoiding circular runtime dependencies.
import type { TestDefinition, TestResult, TimeSeriesSample } from '../../shared/types'

/**
 * Interface defining callback functions passed into `start()`.
 * In TypeScript, an `interface` defines a contract or blueprint for what an object looks like.
 *
 * Here, any object passed as callbacks MUST provide:
 * 1. `onSample`: A function called periodically during the test to stream live metrics (RPS, latency, etc.)
 * 2. `onDone`: A function called when the test completes or encounters a fatal error.
 *    - `err`: An Error object if something broke, or `null` if the test succeeded.
 *    - `result`: The final summarized TestResult.
 */
export interface EngineStartCallbacks {
  onSample: (sample: TimeSeriesSample) => void
  onDone: (err: Error | null, result: TestResult) => void
}

/**
 * Interface representing an active, in-flight load test.
 * - `instance`: The running Autocannon process instance (which has methods like `.stop()`).
 * - `startedAt`: Timestamp (in milliseconds) when the test began, used to calculate elapsed time.
 */
interface Holding {
  instance: autocannon.Instance
  startedAt: number
}

/**
 * In-memory map of running tests: Key = runId (number), Value = Holding object.
 * TypeScript syntax `new Map<number, Holding>()` specifies that keys must be numbers
 * and values must match the Holding interface defined above.
 * This allows us to track, query (`isRunning`), or abort (`stop`) tests by their ID.
 */
const holding = new Map<number, Holding>()

/**
 * Constants for latency sampling:
 * - `RESERVOIR_CAP`: Max number of latency numbers kept in memory at any time.
 *   Load tests can generate tens of thousands of requests per second. Keeping every single
 *   response time in an array would quickly consume all RAM. We cap the buffer to 1024 numbers.
 * - `SAMPLE_EVERY`: Only record latency for every 2nd response to reduce CPU overhead.
 */
const RESERVOIR_CAP = 1024
const SAMPLE_EVERY = 2

/**
 * Helper function to calculate a percentile (e.g., p50/median) from a sorted array of numbers.
 *
 * @param sorted - An array of response times in ascending order (smallest to largest).
 * @param p - Percentile between 0 and 1 (e.g., 0.5 for 50th percentile / median).
 * @returns The latency value at that percentile, rounded to the nearest integer.
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  // Calculate index: for length 10 and p = 0.5, idx = Math.floor(0.5 * 9) = 4.
  const idx = Math.floor(p * (sorted.length - 1))
  // Clamp idx within array bounds and round the value.
  return Math.round(sorted[Math.max(0, Math.min(idx, sorted.length - 1))])
}

/**
 * Validates test parameters before starting the engine.
 *
 * @param config - The test settings (URL, connections, duration, etc.)
 * @returns An array of error message strings. If empty, the configuration is valid.
 */
export function validate(config: TestDefinition): string[] {
  const errors: string[] = []
  // Autocannon uses Node.js HTTP sockets; more than 10,000 connections can exhaust system file descriptors.
  if (config.load.connections > 10000) errors.push('Autocannon supports at most 10000 connections')
  return errors
}

/**
 * Checks if a test with the given runId is currently active.
 *
 * @param runId - Unique identifier of the test run.
 * @returns `true` if the test is currently running in the `holding` map, `false` otherwise.
 */
export function isRunning(runId: number): boolean {
  return holding.has(runId)
}

/**
 * Internal state maintained while a load test is executing.
 * This keeps track of counters and collected samples between periodic ticks.
 */
interface RunState {
  totalRequests: number       // Cumulative count of requests sent so far
  totalErrors: number         // Cumulative count of HTTP errors and network failures
  reqCount: number            // Total responses observed (used for SAMPLE_EVERY modulo check)
  lastTickAt: number          // Timestamp of the previous tick event (to calculate delta time)
  reservoir: number[]         // Ring-buffered array of recent latency values (in milliseconds)
  samples: TimeSeriesSample[] // Collected history of time-series samples for plotting charts
}

/**
 * Helper to construct a `TimeSeriesSample` data point for live graphing.
 *
 * @param state - The current mutable test state.
 * @param startedAt - Test start timestamp in milliseconds.
 * @param rps - Calculated requests per second during this tick interval.
 * @param throughput - Bytes per second transferred during this tick interval.
 * @returns A structured TimeSeriesSample object.
 */
function sampleFor(state: RunState, startedAt: number, rps: number, throughput: number): TimeSeriesSample {
  // Sort a copy of the reservoir array to find the median latency (50th percentile).
  // `[...state.reservoir]` creates a shallow copy so `.sort()` doesn't mutate the original array.
  const sorted = [...state.reservoir].sort((a, b) => a - b)
  return {
    t: Math.round((Date.now() - startedAt) / 1000), // Seconds elapsed since test started
    rps,
    latency: percentile(sorted, 0.5),               // Median (p50) latency for this window
    errors: 0,
    throughput,
    totalRequests: state.totalRequests,
    totalErrors: state.totalErrors
  }
}

/**
 * Starts an Autocannon load test run.
 *
 * @param config - The test definition containing target URL, headers, load parameters, etc.
 * @param runId - Unique numeric ID identifying this run.
 * @param cb - Callbacks for streaming intermediate metrics and reporting the final result.
 */
export function start(config: TestDefinition, runId: number, cb: EngineStartCallbacks): void {
  // 1. Map LoadLab's generic TestDefinition into autocannon-specific options:
  const opts: autocannon.Options = {
    url: config.target.url,
    method: config.target.method,
    headers: config.target.headers ?? {}, // `??` is nullish coalescing: defaults to {} if null/undefined
    body: config.target.body || undefined,
    connections: config.load.connections, // Number of concurrent virtual users/connections
    duration: config.load.durationSeconds, // How long to run in seconds
    pipelining: config.load.pipelining     // Number of pipelined requests per connection
  }
  // Optional rate limit (requests per second cap across all connections)
  if (config.load.rate && config.load.rate > 0) opts.overallRate = config.load.rate

  // 2. Initialize tracking state for this run:
  const startedAt = Date.now()
  const state: RunState = {
    totalRequests: 0,
    totalErrors: 0,
    reqCount: 0,
    lastTickAt: startedAt,
    reservoir: [],
    samples: []
  }

  // Quick helper to take a point-in-time snapshot of the current state
  const snapshot = (): TimeSeriesSample =>
    sampleFor(state, startedAt, 0, 0)

  // 3. Launch autocannon:
  // Calling autocannon(opts, completionCallback) begins sending HTTP traffic immediately.
  // The completion callback is called when the test duration finishes or if a fatal error occurs.
  const instance = autocannon(opts, (err, raw) => {
    // Test is finished: remove it from active runs map
    holding.delete(runId)

    // If an error occurred starting or running the test, inform caller and stop
    if (err) {
      // In TypeScript, `as unknown as TestResult` is a type cast telling the compiler
      // "treat null as TestResult here" because the callback signature expects a TestResult.
      cb.onDone(err, null as unknown as TestResult)
      return
    }

    // Type assertion: Autocannon's raw result object doesn't always have full type definitions,
    // so we define an inline shape for the properties we want to safely read from it.
    const r = raw as {
      duration?: number
      requests?: { total?: number; average?: number; sent?: number }
      throughput?: { average?: number }
      latency?: { average?: number; p50?: number; p90?: number; p95?: number; p99?: number }
      errors?: number
      timeouts?: number
      non2xx?: number
      statusCodeStats?: Record<string, { count: number }>
    }

    // Convert statusCodeStats object (e.g. { "200": { count: 50 }, "404": { count: 2 } })
    // into a cleaner Record<string, number> (e.g. { "200": 50, "404": 2 })
    const statusCodes: Record<string, number> = {}
    if (r.statusCodeStats) {
      for (const [code, info] of Object.entries(r.statusCodeStats)) statusCodes[code] = info.count
    }

    const final = snapshot()
    // Optional chaining (?.) and nullish coalescing (??) ensure safe fallback if r.latency is undefined:
    const avgLat = final.latency || Math.round(r.latency?.average ?? 0)

    // Build the final comprehensive TestResult object and send it to onDone:
    cb.onDone(null, {
      runId,
      engine: 'autocannon',
      startedAt: new Date(startedAt).toISOString(),
      finishedAt: new Date().toISOString(),
      durationSec: r.duration ? Math.round(r.duration) : config.load.durationSeconds,
      requests: r.requests?.total ?? state.totalRequests,
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
      timeSeries: state.samples // Full array of samples recorded throughout the test
    })
  })

  // 4. Set up Event Listeners on the Autocannon instance:

  // 'response' event: Fires every time an individual HTTP response is received.
  instance.on('response', (_client: unknown, statusCode: unknown, _bytes: unknown, responseTime: number) => {
    // If status code does not start with '2' (e.g. 404, 500, etc.), count it as an HTTP error
    if (!String(statusCode).startsWith('2')) state.totalErrors++

    state.reqCount++
    // Only sample every SAMPLE_EVERY requests (every 2nd request) to reduce CPU overhead
    if (state.reqCount % SAMPLE_EVERY !== 0) return

    // Store response time (latency in ms) into our reservoir
    state.reservoir.push(responseTime)
    // Keep reservoir within maximum capacity by dropping oldest values (FIFO)
    if (state.reservoir.length > RESERVOIR_CAP) state.reservoir.splice(0, state.reservoir.length - RESERVOIR_CAP)
  })

  // 'reqError' event: Fires when a request fails before getting a response (e.g. DNS failure, connection refused)
  instance.on('reqError', () => {
    state.totalErrors++
  })

  // 'tick' event: Autocannon emits this event periodically (usually once every second).
  // Contains progress counters since the last tick (e.g. how many requests completed in this second).
  instance.on('tick', (data?: { counter: number; bytes: number }) => {
    const { counter = 0, bytes = 0 } = data ?? {}
    state.totalRequests += counter

    // Calculate actual elapsed seconds (dt) since the previous tick to compute accurate rate per second
    const now = Date.now()
    const dt = (now - state.lastTickAt) / 1000
    state.lastTickAt = now

    // Generate a sample data point with current RPS and throughput
    const sample = sampleFor(state, startedAt, dt > 0 ? Math.round(counter / dt) : counter, bytes)
    state.samples.push(sample)

    // Stream the sample to the caller so UI charts can update in real-time
    cb.onSample(sample)
  })

  // 5. Store the running instance in the `holding` map so it can be managed or aborted
  holding.set(runId, { instance, startedAt })
}

/**
 * Stops an ongoing load test immediately before its scheduled duration ends.
 *
 * @param runId - The ID of the test run to stop.
 */
export function stop(runId: number): void {
  const h = holding.get(runId)
  if (h) h.instance.stop() // Calls Autocannon's built-in .stop() method to shut down connections
}