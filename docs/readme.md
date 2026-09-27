# LoadLab

> Local-first load testing for developers.

LoadLab is a desktop application for configuring and running HTTP load tests directly from your own machine.

Instead of sending your target URL to a remote load-generation server, LoadLab generates the traffic locally.

That means you can test:

- `localhost`
- `127.0.0.1`
- Docker / Podman containers
- LAN / internal VPN services
- Staging APIs
- Deployed APIs & production endpoints you are authorized to test


## Why LoadLab?

Traditional hosted load-testing platforms require the load generator to reach your target from their infrastructure.

That creates a fundamental obstacle for local development:

```mermaid
flowchart TD
    subgraph LocalHost ["Your Local Environment"]
        API["Local Service / Docker\nhttp://localhost:8080"]
    end
    Cloud["Cloud Load Generator"] -.->|❌ Cannot reach private network| API

    style LocalHost fill:#1e1e24,stroke:#2f80ed,stroke-width:2px,color:#fff
    style API fill:#2a2b36,stroke:#2f80ed,stroke-width:2px,color:#fff
    style Cloud fill:#252528,stroke:#eb5757,stroke-dasharray: 5 5,color:#aaa
```

LoadLab changes the model by placing the generator directly on your machine:

```mermaid
flowchart TD
    subgraph LocalMachine ["Your Machine"]
        subgraph LoadLabApp ["LoadLab Desktop"]
            UI["Test UI & Config"]
            Engine["Load Engine (Autocannon)"]
            Results["Live Telemetry & Results"]
        end
        Target["API Target (localhost:8080)"]
        UI --> Engine
        Engine -->|Direct local traffic| Target
        Engine --> Results
    end

    style LocalMachine fill:#1e1e24,stroke:#4fbb87,stroke-width:2px,color:#fff
    style LoadLabApp fill:#2a2b36,stroke:#4fbb87,stroke-width:1px,color:#fff
    style Target fill:#252528,stroke:#2f80ed,stroke-width:2px,color:#fff
```

The same application can then test deployed environments without changing workflows:

```mermaid
flowchart LR
    LoadLab["LoadLab"] -->|Local| L["localhost:8080"]
    LoadLab -->|Staging| S["staging.example.com"]
    LoadLab -->|Production| P["api.example.com"]
```


## Core Idea: Engine Orchestration

LoadLab is an orchestration and visualization layer around proven load-testing engines.

```mermaid
flowchart TD
    LoadLab["LoadLab Engine Adapter Layer"]
    LoadLab --> AC["Autocannon (Default, In-process)"]
    LoadLab --> OHA["oha (High-throughput Rust CLI)"]
    LoadLab --> WRK["wrk (Low-latency C CLI)"]
    LoadLab --> VEG["Vegeta (Constant-rate testing)"]
    LoadLab --> K6["k6 (Scripted load scenarios)"]
```

The engines perform the actual load generation. LoadLab provides a unified developer experience, live dashboards, and SQLite-backed reporting.


## Features

### Current
- Windows desktop application (Electron 35 + React 18 + TypeScript)
- No mandatory account or telemetry
- Local-first traffic generation
- HTTP/1.1 load testing via Autocannon adapter
- Multi-tab test builder with headers, method, body, connections, pipelining, duration, and rate capping
- Live Recharts dashboard (streaming RPS, latency, and errors)
- Statistical latency percentiles (Average, p50, p90, p95, p99)
- Detailed status code distribution tracking
- Scenarios & Collections management
- Local SQLite database with WAL mode for history and runs
- JSON collection import/export and JSON/CSV run report export

### Planned / Extensible
- Additional engine adapters (`oha`, `wrk`, `k6`, `vegeta`)
- Side-by-side run comparison
- HTML report generation
- gRPC load testing (via `ghz`)
- Browser-level synthetic testing
- Distributed load generation agents

---

## Architecture

```mermaid
flowchart TB
    subgraph App ["LoadLab Desktop"]
        UI["React UI (Builder & Live Dashboard)"]
        Preload["Preload API Bridge (Context Isolation)"]
        Core["Application Runner"]
        
        subgraph EngineLayer ["Engine Adapter Layer"]
            Autocannon["Autocannon Adapter"]
            FutureEngines["oha / wrk / k6"]
        end

        DB[("SQLite Storage (WAL)\nRuns & Scenarios")]
    end

    Target["Target Service"]

    UI <--> Preload
    Preload <--> Core
    Core --> EngineLayer
    EngineLayer -->|Benchmark Requests| Target
    EngineLayer -->|Streaming Metrics| Core
    Core --> DB

    style App fill:#1e1e24,stroke:#4fbb87,stroke-width:2px,color:#fff
    style EngineLayer fill:#2a2b36,stroke:#9b51e0,stroke-width:1px,color:#fff
    style Target fill:#252528,stroke:#eb5757,stroke-width:2px,color:#fff
```

---

## Technology Stack

- **Desktop Shell**: Electron 35
- **Frontend**: React 18, TypeScript, Recharts, Lucide React
- **Build System**: electron-vite, Vite 5
- **Storage**: Native Node.js SQLite (`node:sqlite`)
- **Default Engine**: Autocannon

---

## Development Lifecycle

```mermaid
flowchart LR
    A["⚙️ Configure"] --> B["⚡ Run"]
    B --> C["📈 Observe"]
    C --> D["📊 Analyze"]
    D --> E["💾 Save"]
    E --> F["🔁 Run Again / Compare"]
```

---

## Safety & Ethics

- Only test systems that you own or are explicitly authorized to test.
- Load testing consumes real CPU, bandwidth, and server capacity.
- LoadLab provides confirmation prompts when targeting remote hosts and high-concurrency configurations.
