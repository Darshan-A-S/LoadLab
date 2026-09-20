# LoadLab --- Local Load Agent

## 1. Purpose

The LoadLab Agent is the local execution layer responsible for
generating traffic from the user's own machine.

In the first architecture, the agent is part of the desktop application
rather than a separately installed service.

The important principle is:

> The user's computer generates the load. LoadLab does not need a
> powerful central load-generation server.

## 2. Responsibilities

The agent/core execution layer is responsible for:

-   Receiving validated test configurations
-   Selecting an engine
-   Starting the engine
-   Passing configuration to the engine
-   Collecting output
-   Converting output into normalized metrics
-   Streaming metrics to the UI
-   Stopping the engine
-   Handling process failures
-   Returning final results

## 3. Process Model

``` text
LoadLab Desktop
      │
      ▼
Test Runner
      │
      ▼
Engine Adapter
      │
      ▼
Child Process
      │
      ├──── stdout/stderr
      │
      ▼
Metrics Parser
      │
      ▼
Metrics Aggregator
      │
      ├──────▶ Live UI
      │
      └──────▶ SQLite
```

## 4. Engine Adapter

Each engine should be hidden behind a common interface.

Conceptual TypeScript design:

``` text
interface LoadEngine {
  id: string;
  name: string;

  validate(config): ValidationResult;

  start(config): RunningTest;

  stop(runId): Promise<void>;

  onMetrics(callback): Unsubscribe;

  getResult(runId): Promise<TestResult>;
}
```

The exact API can evolve during implementation.

## 5. Autocannon Adapter

The first adapter should wrap Autocannon programmatically.

The application should prefer the Node API over shelling out to the CLI
when practical.

Responsibilities:

``` text
AutocannonAdapter
├── Validate configuration
├── Build autocannon options
├── Start benchmark
├── Receive progress/statistics
├── Convert statistics
├── Emit normalized metrics
└── Return final result
```

## 6. Other Engines

Future adapters:

``` text
EngineManager
│
├── AutocannonAdapter
├── OhaAdapter
├── WrkAdapter
└── VegetaAdapter
```

The UI should interact with `EngineManager`, not individual engines.

## 7. Process Isolation

If an engine requires a native executable:

-   Launch it as a child process.
-   Never concatenate user input into a shell command.
-   Use structured process arguments.
-   Track the process ID.
-   Kill the process and its children when the test is stopped.
-   Capture stdout and stderr separately.

## 8. Resource Controls

A local load generator can consume significant:

-   CPU
-   RAM
-   Network bandwidth
-   File descriptors
-   Ephemeral ports

The application should show a warning for aggressive configurations.

Example:

``` text
This test may generate significant traffic and CPU usage.

Connections: 10,000
Duration: 10 minutes

[ Cancel ] [ Continue ]
```

## 9. Target Safety

LoadLab should distinguish between:

``` text
Local target
Remote target
```

For remote targets, display:

``` text
You are about to generate load against:

https://api.example.com

Make sure you are authorized to test this system.
```

The application should not attempt to bypass rate limits,
authentication, WAFs, CAPTCHAs, or other access controls.

## 10. Metrics Pipeline

Raw engine output should not be sent directly to the UI.

Use:

``` text
Raw Metrics
     │
     ▼
Parser
     │
     ▼
Normalizer
     │
     ▼
Aggregator
     │
     ├── Live snapshot
     └── Time-series samples
```

This allows different engines to produce a consistent dashboard.

## 11. Agent Lifecycle

``` text
IDLE
 │
 ├── start()
 ▼
STARTING
 │
 ▼
RUNNING
 │  │
 │  ├── stop()
 │  │
 │  └── engine failure
 │
 ▼
STOPPING
 │
 ▼
COMPLETED / FAILED
```

The UI should always receive a final state.

## 12. Future Standalone Agent

The architecture should leave room for a future standalone agent:

``` text
LoadLab Desktop
      │
      │ secure local protocol
      ▼
loadlab-agent.exe
      │
      ▼
Engine
```

This could eventually support:

-   Headless execution
-   CI/CD
-   Remote workers
-   Distributed testing
-   Multiple machines

This is future scope and should not complicate the MVP unnecessarily.

## 13. Distributed Future

Eventually:

``` text
                  Controller
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
     Agent A       Agent B       Agent C
       200           200           200
       users         users         users
        │             │             │
        └─────────────┼─────────────┘
                      ▼
                  Target API
```

Each agent generates load locally and reports normalized metrics to the
controller.

The current local-only design should keep this future architecture
possible without implementing it now.
