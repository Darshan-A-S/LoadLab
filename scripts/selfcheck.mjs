import http from 'node:http'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import * as autocannon from '../src/main/engine/autocannon.ts'
import * as loadtest from '../src/main/engine/loadtest.ts'
import * as oha from '../src/main/engine/oha.ts'
import * as bombardier from '../src/main/engine/bombardier.ts'

const server = http.createServer((req, res) => {
  setTimeout(() => {
    res.writeHead(req.url === '/err' ? 500 : 200, { 'content-type': 'text/plain' })
    res.end('ok')
  }, 2)
})
server.listen(0, '127.0.0.1')
await once(server, 'listening')
const port = server.address().port

const engines = [
  { name: 'autocannon', adapter: autocannon },
  { name: 'loadtest', adapter: loadtest },
  { name: 'oha', adapter: oha },
  { name: 'bombardier', adapter: bombardier }
]

console.log('Testing engines against test server on port', port)

for (const { name, adapter } of engines) {
  console.log(`\n--- Testing ${name} ---`)
  const samples = []
  const config = {
    name: `selfcheck-${name}`,
    target: { url: `http://127.0.0.1:${port}/api`, method: 'GET' },
    load: { connections: 3, durationSeconds: 2, pipelining: 1 },
    engine: name
  }

  const result = await new Promise((resolve, reject) => {
    adapter.start(config, 1, {
      onSample: (s) => samples.push(s),
      onDone: (err, r) => (err ? reject(err) : resolve(r))
    })
  })

  assert.ok(result.requests > 0, `${name}: expected requests > 0, got ${result.requests}`)
  assert.ok(result.requestsPerSecond > 0, `${name}: expected rps > 0, got ${result.requestsPerSecond}`)
  assert.ok(result.durationSec >= 1, `${name}: expected durationSec >= 1, got ${result.durationSec}`)
  assert.ok(typeof result.latency.average === 'number', `${name}: expected latency.average`)
  assert.ok(typeof result.latency.p50 === 'number', `${name}: expected latency.p50`)
  assert.ok(typeof result.errors === 'number', `${name}: expected errors to be number`)
  assert.ok(result.statusCodes && result.statusCodes['200'] > 0, `${name}: expected 200 counts`)

  console.log(`PASS: ${name} produced ${result.requests} requests (${result.requestsPerSecond} req/s), p50 ${result.latency.p50}ms`)
}

// Also test error path for autocannon & loadtest
const errConfig = {
  name: 'selfcheck-err',
  target: { url: `http://127.0.0.1:${port}/err`, method: 'GET' },
  load: { connections: 3, durationSeconds: 1, pipelining: 1 },
  engine: 'autocannon'
}
const errResult = await new Promise((resolve, reject) => {
  autocannon.start(errConfig, 2, {
    onSample: () => {},
    onDone: (e, r) => (e ? reject(e) : resolve(r))
  })
})
server.close()
assert.ok(errResult.statusCodes['500'] > 0, `expected 500 counts, got ${JSON.stringify(errResult.statusCodes)}`)
assert.ok(errResult.errors > 0, 'expected non-zero errors on 500 path')
console.log('PASS: error path counted', errResult.statusCodes['500'], 'x 500, errors', errResult.errors)
console.log('\nALL ENGINE SELFCHECKS PASSED!')