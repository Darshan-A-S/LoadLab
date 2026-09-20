# LoadLab --- Architecture

## 1. Overview

LoadLab is a local-first desktop load-testing application.

Its core principle is:

> The user's machine generates the load, while the application provides
> configuration, orchestration, visualization, and local result storage.

The first version focuses on HTTP/API load testing. The architecture is
intentionally extensible so additional engines and protocols can be
added later.

## 2. High-Level Architecture

``` text
┌──────────────────────────────────────────────────────────────┐
│                         LoadLab Desktop                       │
│                                                              │
│  ┌──────────────────┐      ┌──────────────────────────────┐  │
│  │ React UI         │─────▶│ Application/Core             │  │
│  │                  │      │                              │  │
│  │ Test Builder     │      │ Test orchestration           │  │
│  │ Live Dashboard   │      │ Validation                    │  │
│  │ History          │      │ Engine management             │  │
│  │ Settings         │      │ Result normalization           │  │
│  └──────────────────┘      └──────────────┬───────────────┘  │
│                                           │                  │
│                              ┌────────────▼───────────────┐  │
│                              │ Engine Adapter Layer        │  │
│                              └────────────┬───────────────┘  │
│                                           │                  │
│                       ┌───────────────────┼───────────────┐  │
│                       ▼                   ▼               ▼  │
│                  Autocannon              oha             wrk │
│                                                              │
│                              │                               │
│                              ▼                               │
│                         Target System                        │
│              localhost / LAN / staging / production         │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Local Storage                                           │  │
│  │ Tests • Runs • Results • Settings                      │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## 3. Architectural Principles

### Local-first

No cloud server is required to execute a test.

### Engine-independent

The UI should not depend directly on Autocannon. Engines are accessed
through adapters.

### Normalized results

Different engines produce different output formats. LoadLab converts
them into a common result model.

### Offline-capable

Core testing, visualization, and history should work without an account
or internet connection.

### Secure by default

The application must avoid exposing an unauthenticated local control
API.

## 4. Major Components

### Desktop Shell

Responsible for:

-   Application lifecycle
-   Native window
-   Packaging
-   Auto-update later
-   OS integration

Electron or Tauri can be used. The initial implementation can use
Electron because the project is JavaScript/TypeScript-oriented.

### Renderer/UI

React-based interface responsible for:

-   Test configuration
-   Test execution controls
-   Live metrics
-   Charts
-   Run history
-   Saved test scenarios
-   Settings

The renderer must not directly execute arbitrary system commands.

### Application Core

Responsible for:

-   Validating test configurations
-   Starting/stopping tests
-   Managing test state
-   Communicating with engine adapters
-   Collecting metrics
-   Persisting runs
-   Generating reports

### Engine Adapter Layer

Each engine implements a common interface.

Example conceptual interface:

``` text
EngineAdapter
├── validate(config)
├── start(config)
├── stop(runId)
├── streamMetrics(runId)
└── normalizeResult(rawResult)
```

Initial engines:

-   Autocannon
-   oha
-   wrk

Vegeta can be added after the initial architecture is stable.

### Local Storage

Use SQLite for structured local data.

Store:

-   Test definitions
-   Test runs
-   Metrics summaries
-   Engine used
-   Target metadata
-   Application settings

Large time-series data should be stored carefully to avoid unnecessarily
large databases.

## 5. Test Lifecycle

``` text
Create Test
    │
    ▼
Validate Configuration
    │
    ▼
Select Engine
    │
    ▼
Prepare Engine
    │
    ▼
Start Process
    │
    ▼
Collect Metrics
    │
    ├──────▶ Live Dashboard
    │
    ▼
Test Complete
    │
    ▼
Normalize Results
    │
    ▼
Persist Run
    │
    ▼
Results / History
```

## 6. Target Network Model

The target is not required to be hosted by LoadLab.

``` text
LoadLab ──HTTP──▶ localhost
LoadLab ──HTTP──▶ LAN service
LoadLab ──HTTP──▶ staging
LoadLab ──HTTP──▶ production
```

The target must simply be reachable from the user's machine.

## 7. Future Architecture

Potential future additions:

-   gRPC engine using ghz
-   Fortio integration
-   Browser testing
-   Database benchmarking
-   Distributed agents
-   Optional cloud synchronization
-   Team workspaces
-   Shared test scenarios

These should not be required by the MVP.
