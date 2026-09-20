# LoadLab --- Requirements

## 1. Goal

Build a local-first desktop application that allows developers to
configure, execute, monitor, save, and analyze load tests against
endpoints reachable from their own computer.

## 2. Core Requirements

### R1 --- Desktop Application

The product must run as a standalone Windows application.

The user should not need to install:

-   Node.js
-   npm
-   Autocannon
-   wrk
-   oha

separately.

The application installer should bundle required runtime dependencies
and supported engines.

### R2 --- No Mandatory Account

The MVP must work without:

-   Sign-up
-   Login
-   API key
-   Cloud account

### R3 --- HTTP Target Support

Users must be able to specify:

-   HTTP URL
-   HTTP method
-   Headers
-   Request body

Support at minimum:

-   GET
-   POST
-   PUT
-   PATCH
-   DELETE

### R4 --- Load Configuration

Users must be able to configure:

-   Duration
-   Number of connections
-   Requests/rate where supported
-   Pipelining where supported
-   Warm-up behavior if supported later

### R5 --- Localhost Testing

The application must support targets such as:

``` text
http://localhost:3000
http://127.0.0.1:8080/api
```

### R6 --- Remote Testing

The application must support reachable remote targets such as:

``` text
https://staging.example.com
https://api.example.com
```

The application must not require the remote server to connect back to
LoadLab.

### R7 --- Engine Integration

MVP engine:

-   Autocannon

Next engines:

-   oha
-   wrk
-   Vegeta

The engine integration must use an adapter interface.

### R8 --- Live Results

During a test, display:

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
-   Elapsed time

### R9 --- Charts

At minimum:

-   Requests/sec over time
-   Latency over time
-   Errors over time

### R10 --- Test Control

Users must be able to:

-   Start a test
-   Stop a running test
-   Run the same test again

Stopping a test must terminate the underlying load-generation process
cleanly.

### R11 --- History

Store completed test runs locally.

A history entry should contain:

-   Test name
-   Target
-   Engine
-   Date/time
-   Duration
-   Main metrics
-   Result status

### R12 --- Saved Scenarios

Users should be able to save and edit reusable test configurations.

### R13 --- Export

MVP:

-   JSON
-   CSV

Later:

-   HTML
-   PDF

### R14 --- Error Handling

The application must clearly report:

-   Invalid URL
-   Unreachable target
-   DNS failure
-   Connection failure
-   TLS errors
-   Invalid configuration
-   Engine failure
-   Permission failure
-   Test interruption

### R15 --- Security

The application must:

-   Avoid shell command injection
-   Validate engine arguments
-   Avoid exposing control interfaces publicly
-   Protect stored secrets
-   Warn before high-impact tests against external targets

## 3. Non-Functional Requirements

### NFR1 --- Performance

The UI must remain responsive while the load engine is running.

### NFR2 --- Reliability

A failed test must not crash the desktop application.

### NFR3 --- Portability

The initial target is Windows.

Future targets:

-   Linux
-   macOS

### NFR4 --- Privacy

Core test data should remain local unless the user explicitly chooses a
cloud feature.

### NFR5 --- Extensibility

Adding another engine should not require rewriting the UI.

## 4. MVP Scope

### Included

-   Windows desktop application
-   React UI
-   HTTP testing
-   Autocannon
-   Test builder
-   Live dashboard
-   Test history
-   Saved scenarios
-   JSON/CSV export
-   Local SQLite storage
-   Start/stop controls

### Excluded from MVP

-   Cloud execution
-   User accounts
-   Team collaboration
-   Distributed testing
-   Browser load testing
-   Database benchmarking
-   gRPC
-   Hosted dashboards
-   Billing

## 5. Future Scope

### Phase 2

-   oha
-   wrk
-   Vegeta
-   Advanced charts
-   Test comparison
-   HTML reports

### Phase 3

-   gRPC / ghz
-   Fortio
-   Browser workflows
-   Advanced request scenarios

### Phase 4

-   Optional accounts
-   Cloud synchronization
-   Shared reports
-   Team workspaces
-   Distributed load agents

## 6. Success Criteria

The MVP is successful when a developer can:

1.  Download the application.
2.  Install it without manually installing the benchmark engine.
3.  Enter a localhost API URL.
4.  Configure load.
5.  Run the test.
6.  Watch live metrics.
7.  Stop or complete the test.
8.  Inspect the final result.
9.  Save the test.
10. Run the same test against a deployed URL.
11. Export the result.
