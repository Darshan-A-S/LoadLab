import http from 'node:http'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { start } from '../src/main/engine/autocannon.ts'

const server = http.createServer((req, res) => {
  setTimeout(() => {
    res.writeHead(req.url === '/err' ? 500 : 200, { 'content-type': 'text/plain' })
    res.end('ok')
  }, 2)
})
server.listen(0, '127.0.0.1')
await once(server, 'listening')
const port = server.address().port

const config = {
  name: 'selfcheck',
  target: { url: `http://127.0.0.1:${port}/api`, method: 'GET' },
  load: { connections: 5, durationSeconds: 2, pipelining: 1 },
  engine: 'autocannon'
}

const samples = []
const result = await new Promise((resolve, reject) => {
  start(config, 1, {
    onSample: (s) => samples.push(s),
    onDone: (err, r) => (err ? reject(err) : resolve(r))
  })
})

console.log('live samples:', JSON.stringify(samples.slice(-2)))

assert.ok(samples.length >= 1, `expected live samples, got ${samples.length}`)
assert.ok(samples.some((s) => s.rps > 0), 'expected non-zero rps in live samples')
assert.ok(result.requests > 0, 'expected requests > 0')
assert.ok(result.requestsPerSecond > 0, 'expected rps > 0')
assert.ok(result.latency.p50 > 0 && result.latency.p50 < 1000, `expected sane p50 latency, got ${result.latency.p50}`)
assert.ok(Array.isArray(result.timeSeries), 'expected timeSeries on result')
assert.ok((result.latency.p95 ?? 0) >= (result.latency.p50 ?? 0), 'p95 >= p50')
assert.equal(typeof result.errors, 'number')
assert.ok(result.statusCodes && result.statusCodes['200'] > 0, `expected status 200 counts, got ${JSON.stringify(result.statusCodes)}`)

console.log('PASS: adapter produced', result.requests, 'requests, p50', result.latency.p50, 'ms, p95', result.latency.p95, 'ms, samples', samples.length)

const errConfig = {
  name: 'selfcheck-err',
  target: { url: `http://127.0.0.1:${port}/err`, method: 'GET' },
  load: { connections: 3, durationSeconds: 1, pipelining: 1 },
  engine: 'autocannon'
}
const errResult = await new Promise((resolve, reject) => {
  start(errConfig, 2, {
    onSample: () => {},
    onDone: (e, r) => (e ? reject(e) : resolve(r))
  })
})
server.close()
assert.ok(errResult.statusCodes['500'] > 0, `expected 500 counts, got ${JSON.stringify(errResult.statusCodes)}`)
assert.ok(errResult.errors > 0, 'expected non-zero errors on 500 path')
assert.ok(errResult.timeSeries.some((s) => s.totalErrors > 0), 'live totalErrors should track non-2xx')
assert.ok(errResult.errors <= errResult.requests, `errors (${errResult.errors}) can never exceed requests sent (${errResult.requests})`)
console.log('PASS: error path counted', errResult.statusCodes['500'], 'x 500, errors', errResult.errors)