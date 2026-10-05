<div align="center">

<img src="./load-lab-svg.svg" alt="LoadLab Logo" width="100" height="100" />

# LoadLab

**Local-first HTTP load testing for developers.**

Generate high-performance load tests directly from your desktop against `localhost`, Docker containers, internal networks, or remote APIs — with zero cloud lock-in and zero remote telemetry.

[![Node.js](https://img.shields.io/badge/Node.js-22+-68a063.svg?logo=node.js&logoColor=white)](#tech-stack)
[![Electron](https://img.shields.io/badge/Electron-35+-47848F.svg?logo=electron&logoColor=white)](#tech-stack)
[![React](https://img.shields.io/badge/React-18+-61DAFB.svg?logo=react&logoColor=black)](#tech-stack)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178C6.svg?logo=typescript&logoColor=white)](#tech-stack)
[![License: Private](https://img.shields.io/badge/License-MIT%20or%20Private-orange.svg)](#)

</div>

---

## 🎯 Why LoadLab?

Traditional cloud-based load testing services generate traffic from their remote servers. That introduces a major roadblock for local development: **cloud services cannot reach your private `localhost` or Docker network without opening firewalls, setting up tunnels, or deploying unfinished code to staging.**

LoadLab flips the architecture: traffic is generated directly from your local machine.

```mermaid
flowchart TD
    subgraph LocalMachine ["Your Local Machine"]
        API["Local Service / Docker Container\n(e.g., http://localhost:3000)"]
        LoadLab["LoadLab Desktop App\n(Local Traffic Generator)"]
        LoadLab -->|" Direct Local Traffic (Zero Tunneling / Firewall Config) "| API
    end

    CloudGen["Cloud Load Testing Platform"] -.->|" ❌ Blocked / Cannot Reach Localhost "| API

    style LocalMachine fill:#1e1e24,stroke:#4fbb87,stroke-width:2px,color:#fff
    style LoadLab fill:#2a2b36,stroke:#4fbb87,stroke-width:2px,color:#fff
    style API fill:#2a2b36,stroke:#2f80ed,stroke-width:2px,color:#fff
    style CloudGen fill:#252528,stroke:#eb5757,stroke-dasharray: 5 5,color:#aaa
```

With LoadLab, you can effortlessly test:
- **`localhost` & `127.0.0.1` microservices**
- **Docker / Podman containers & Compose networks**
- **Internal VPN / LAN development environments**
- **Staging and production endpoints** (with built-in remote target authorization warnings)

---

## Key Features

- **Native Local Engine Execution**: Benchmarks execute locally with maximum throughput and minimal overhead.
- **Real-Time Interactive Dashboard**: Watch live requests/sec (RPS), latencies, and errors update in real time with Recharts.
- **Precise Latency Percentiles**: Detailed response time distributions: **Average, p50, p90, p95, and p99**.
- **Multi-Tab Workspace**: Run multiple tests, compare scenarios side-by-side, and inspect history without losing your setup.
- **Collections & Scenario Management**: Organize API tests into reusable suites and scenarios.
- **Embedded SQLite Storage**: All test configurations, runs, and time-series telemetry are stored locally in SQLite with WAL mode.
- **Import & Export**: One-click JSON collection import/export and JSON/CSV run report generation.
- **Built-in Safety Guardrails**: Proactive confirmation prompts when targeting external remote hosts or using aggressive concurrency configs.
- **Pluggable Engine Architecture**: Comes out-of-the-box with **Autocannon**, **loadtest**, **Artillery**, and native high-performance **[oha](https://github.com/hatoo/oha)** (Rust) and **[Bombardier](https://github.com/codesenberg/bombardier)** (Go) engines.

---

## 🔁 User Workflow

```mermaid
flowchart LR
    A["⚙️ 1. Configure\nTarget, Concurrency,\nDuration & Headers"] --> B["⚡ 2. Execute\nLocal traffic generation\n(In-process or CLI)"]
    B --> C["📈 3. Live Monitor\nStreaming RPS, latency\n& error rates"]
    C --> D["📊 4. Analyze\np50, p90, p99 percentiles\n& status code breakdowns"]
    D --> E["💾 5. Save & Export\nSave to Collection\nor export CSV/JSON"]

    style A fill:#252836,stroke:#4fbb87,stroke-width:2px,color:#fff
    style B fill:#252836,stroke:#f2994a,stroke-width:2px,color:#fff
    style C fill:#252836,stroke:#2f80ed,stroke-width:2px,color:#fff
    style D fill:#252836,stroke:#9b51e0,stroke-width:2px,color:#fff
    style E fill:#252836,stroke:#4fbb87,stroke-width:2px,color:#fff
```

---

## 🏛️ Application Architecture

LoadLab follows a secure, process-isolated Electron architecture:

```mermaid
flowchart TB
    subgraph Renderer ["Renderer Process (React + Vite)"]
        UI["🖥️ User Interface\nBuilder • Dashboard • Collections • History"]
        Charts["📊 Recharts Live Telemetry\nRPS & Latency Stream"]
    end

    subgraph Preload ["Preload Boundary (Secure IPC)"]
        API["window.loadlab Bridge\nContext Isolation & Typed Channels"]
    end

    subgraph Main ["Main Process (Electron + Node.js)"]
        Runner["⚙️ Runner Orchestrator\nLifecycle • Active Runs • Timers"]
        
        subgraph EngineLayer ["Engine Adapter Layer"]
            Autocannon["🚀 Autocannon Adapter\n(In-Process Node API)"]
            OtherEngines["🔌 Future Adapters\n(oha / wrk / k6 via Child Processes)"]
        end

        DB[("💾 Local SQLite DB (WAL)\nRuns • Scenarios • Collections")]
        Export["📁 Exporter\nJSON & CSV Data"]
    end

    Target["🎯 Target Web Server / API\n(Localhost, Docker, Staging, Prod)"]

    UI <-->|" Typed Events "| API
    API <-->|" IPC Channels "| Main
    Runner -->|" Orchestrates "| EngineLayer
    Autocannon -->|" HTTP Traffic "| Target
    Autocannon -->|" Stream TimeSeriesSample "| Runner
    Runner -->|" Push Metrics "| API
    Runner -->|" Persist TestResult "| DB
    Main --> Export

    style Renderer fill:#1e1e24,stroke:#2f80ed,stroke-width:2px,color:#fff
    style Preload fill:#1e1e24,stroke:#f2994a,stroke-width:2px,color:#fff
    style Main fill:#1e1e24,stroke:#4fbb87,stroke-width:2px,color:#fff
    style EngineLayer fill:#2a2b36,stroke:#9b51e0,stroke-width:1px,color:#fff
    style DB fill:#2a2b36,stroke:#4fbb87,stroke-width:2px,color:#fff
    style Target fill:#252528,stroke:#eb5757,stroke-width:2px,color:#fff
```

---

## 🔌 Pluggable Engine Architecture

Engines in LoadLab are decoupled using a unified adapter interface. The UI and database do not depend on engine-specific metrics formats.

```mermaid
flowchart TD
    Runner["Runner (src/main/runner.ts)"] -->|"EngineAdapter Interface"| Registry{"Engine Registry"}
    
    Registry -->|"adapter: 'autocannon'"| AC["Autocannon Adapter\n(High-performance Node engine)"]
    Registry -->|"adapter: 'oha'"| OHA["oha Adapter\n(Rust CLI subprocess)"]
    Registry -->|"adapter: 'wrk'"| WRK["wrk Adapter\n(C CLI subprocess)"]
    Registry -->|"adapter: 'k6'"| K6["k6 Adapter\n(Go / JS scenario runner)"]

    AC --> Normalized["Normalized TestResult & TimeSeriesSample"]
    OHA --> Normalized
    WRK --> Normalized
    K6 --> Normalized

    style Runner fill:#252836,stroke:#4fbb87,stroke-width:2px,color:#fff
    style Registry fill:#252836,stroke:#f2994a,stroke-width:2px,color:#fff
    style Normalized fill:#252836,stroke:#2f80ed,stroke-width:2px,color:#fff
```
---

## 🛠️ Tech Stack

| Layer | Technology | Description |
|---|---|---|
| **Desktop Shell** | [Electron 35](https://www.electronjs.org/) | Cross-platform desktop runtime with sandboxed IPC |
| **Frontend Framework** | [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) | Fast, component-driven UI |
| **Build Tooling** | [electron-vite](https://electron-vite.org/) + [Vite 5](https://vitejs.dev/) | Instant HMR and optimized bundler |
| **Charts & Graphs** | [Recharts](https://recharts.org/) | Real-time SVG time-series visualizer |
| **Icons** | [Lucide React](https://lucide.dev/) | Clean, consistent icons |
| **Local Database** | [Node.js SQLite (`node:sqlite`)](https://nodejs.org/api/sqlite.html) | High-speed local database running in WAL mode |
| **Default Load Engine**| [Autocannon](https://github.com/mcollina/autocannon) | Node.js HTTP/1.1 benchmarking library |

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (version 22+ recommended)
- `npm` (bundled with Node.js)

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/Darshan-A-S/LoadLab.git
cd LoadLab
npm install
```

### Development Mode

Start the app in development mode with Hot Module Replacement (HMR):

```bash
npm run dev
```

### Self-Check & Validation

Run the internal engine validation script to verify that the benchmark runner and metric streams are functioning correctly:

```bash
npm run selfcheck
```

Run TypeScript compilation check:

```bash
npm run typecheck
```

### Building for Production

Compile both the main and renderer processes:

```bash
npm run build
```

To create an installer / distributable package (e.g. Windows NSIS installer):

```bash
npm run dist
```

Artifacts will be output to the `release/` directory.

---

## 🔒 Security & Privacy

- **Zero Cloud Tracking**: All requests, targets, headers, scenarios, and test logs remain exclusively on your computer.
- **Safe Subprocess Spawning**: If using CLI-based benchmark tools, arguments are strictly parameterized arrays — preventing shell injection vulnerabilities.
- **Safety Prompts**: Confirmation dialogues warn users before sending high-frequency traffic to non-local IP addresses or domains.

---

## 📄 License

Private / All Rights Reserved.
