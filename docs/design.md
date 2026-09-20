# LoadLab --- Product & Technical Design

## 1. Product Vision

LoadLab is a developer-focused desktop application for running
performance and load tests directly from the developer's own machine.

The application should make load testing feel closer to tools such as
Postman:

1.  Configure a target.
2.  Configure load.
3.  Run.
4.  Watch live results.
5.  Analyze and compare runs.

No account should be required for the core workflow.

## 2. MVP User Experience

### Home

``` text
┌────────────────────────────────────────────┐
│ LoadLab                                    │
├────────────────────────────────────────────┤
│                                            │
│  Recent Tests                              │
│                                            │
│  Local API Test       2 min ago            │
│  Staging API Test     Yesterday            │
│                                            │
│  [+ New Test]                              │
└────────────────────────────────────────────┘
```

### Test Builder

``` text
Target
[ https://api.example.com/users             ]

Method
[ GET ▼ ]

Load
Connections       [ 100 ]
Duration          [ 30s ]
Pipelining        [ 1 ]

Request
Headers
[ + Add Header ]

Body
[ Optional request body ]

Engine
[ Autocannon ▼ ]

              [ Start Test ]
```

### Running Test

Show:

-   Requests/sec
-   Total requests
-   Active connections
-   Throughput
-   Average latency
-   p50
-   p90
-   p95
-   p99
-   Errors
-   Timeouts
-   Test elapsed time

Charts:

-   Requests/sec over time
-   Latency over time
-   Error rate over time

### Results

``` text
Test Complete

Requests       372,930
RPS             12,431
Avg latency       8.4 ms
p50               7.8 ms
p95              21.4 ms
p99              38.7 ms
Errors                12

[ Save ] [ Export ] [ Run Again ]
```

## 3. Test Definition

A test should be represented independently from the engine.

``` json
{
  "name": "Users API",
  "target": {
    "protocol": "http",
    "url": "http://localhost:8080/api/users",
    "method": "GET"
  },
  "load": {
    "connections": 100,
    "durationSeconds": 30,
    "pipelining": 1
  },
  "request": {
    "headers": {},
    "body": null
  },
  "engine": "autocannon"
}
```

## 4. Result Model

The application should normalize engine-specific metrics into a common
structure.

``` text
TestResult
├── runId
├── testId
├── engine
├── startedAt
├── finishedAt
├── duration
├── requests
├── requestsPerSecond
├── throughput
├── latency
│   ├── average
│   ├── p50
│   ├── p90
│   ├── p95
│   └── p99
├── errors
├── timeouts
└── timeSeries
```

## 5. Engine Selection

The user can select an engine explicitly.

Later, LoadLab may provide:

``` text
Engine: Auto
```

where LoadLab chooses an appropriate engine based on the test
configuration.

This should not be implemented until the adapter abstraction is stable.

## 6. Saved Tests

Users should be able to save reusable scenarios.

Examples:

-   Local Users API
-   Staging Login
-   Production Health Check
-   Checkout API
-   Search API

Sensitive headers such as authorization tokens must not be stored in
plaintext without explicit user consent.

## 7. Test Comparison

Comparison is a high-value feature after the MVP.

Example:

``` text
                 Local        Staging
RPS              12,431        9,820
p50                7.8ms       11.4ms
p95               21.4ms       37.2ms
p99               38.7ms       64.8ms
Errors                12           23
```

The comparison view should display measured values without declaring a
universal winner.

## 8. Export

Initial export formats:

-   JSON
-   CSV
-   HTML report

A later version can add PDF.

## 9. Security Design

The application may execute local binaries. Therefore:

-   Never execute arbitrary shell strings supplied directly by the UI.
-   Validate URLs and test parameters.
-   Use argument arrays rather than shell interpolation.
-   Restrict executable paths to trusted bundled locations.
-   Sanitize filenames and report paths.
-   Do not expose a public network control server by default.
-   If a local API is introduced, bind to loopback only and require a
    session/pairing token.

## 10. Performance

The UI must not become the bottleneck.

Metrics collection should be decoupled from rendering.

Use a small internal event stream:

``` text
Engine
  │
  ▼
Metrics Collector
  │
  ├──▶ Aggregator
  │       │
  │       └──▶ Database
  │
  └──▶ UI event stream
```

The UI should throttle chart updates rather than rendering every raw
event.

## 11. Technology Direction

Suggested MVP stack:

-   Electron
-   React
-   TypeScript
-   Node.js
-   SQLite
-   Charting library
-   Autocannon

Potential alternative:

-   Tauri
-   React
-   Rust
-   SQLite

Electron is a simpler starting point for a Node.js-heavy implementation.
