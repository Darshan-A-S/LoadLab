# LoadLab

> Local-first load testing for developers.

LoadLab is a desktop application for configuring and running HTTP load
tests directly from your own machine.

Instead of sending your target URL to a remote load-generation server,
LoadLab generates the traffic locally.

That means you can test:

-   `localhost`
-   `127.0.0.1`
-   Docker services
-   LAN services
-   Staging APIs
-   Deployed APIs
-   Production endpoints you are authorized to test

## Why LoadLab?

Traditional hosted load-testing platforms require the load generator to
reach your target from their infrastructure.

That creates a problem for local development:

``` text
Your API
localhost:8080
     ▲
     │
     │ cannot be reached
     │
Cloud Load Generator
```

LoadLab changes the model:

``` text
Your Machine
┌─────────────────────────────┐
│                             │
│ LoadLab                     │
│ ├── Test UI                 │
│ ├── Load Engine             │
│ └── Results                 │
│          │                  │
│          ▼                  │
│    localhost:8080           │
│                             │
└─────────────────────────────┘
```

The same application can then test a deployed version:

``` text
LoadLab ──────────▶ localhost:8080
LoadLab ──────────▶ staging.example.com
LoadLab ──────────▶ api.example.com
```

## Core Idea

LoadLab is an orchestration and visualization layer around proven
load-testing engines.

Initial direction:

``` text
LoadLab
   │
   ├── Autocannon
   ├── oha
   ├── wrk
   └── Vegeta
```

The engines perform the actual load generation. LoadLab provides a
unified developer experience.

## Features

### MVP

-   Windows desktop application
-   No mandatory account
-   Local-first execution
-   HTTP load testing
-   Autocannon integration
-   Test builder
-   Live metrics
-   Latency percentiles
-   Error monitoring
-   Test history
-   Saved test scenarios
-   JSON/CSV export

### Planned

-   oha
-   wrk
-   Vegeta
-   Test comparison
-   HTML reports
-   gRPC/ghz
-   Browser testing
-   Optional cloud synchronization
-   Distributed load agents

## Example Workflow

### Test a local API

``` text
Target:
http://localhost:8080/api/users

Connections:
100

Duration:
30 seconds
```

Click **Start Test**.

LoadLab generates the requests directly from your computer.

### Test the deployed API

Change:

``` text
http://localhost:8080/api/users
```

to:

``` text
https://api.example.com/api/users
```

Run the same scenario again.

You can later compare the two runs.

## Architecture

``` text
┌───────────────────────────────────────┐
│              LoadLab                  │
│                                       │
│  React UI                             │
│       │                               │
│       ▼                               │
│  Application Core                     │
│       │                               │
│       ▼                               │
│  Engine Adapter Layer                 │
│       │                               │
│  ┌────┼──────────┐                    │
│  ▼    ▼          ▼                    │
│ Auto  oha       wrk                   │
│       │                               │
│       ▼                               │
│     Target                            │
│                                       │
│  SQLite                               │
│  Test history                         │
└───────────────────────────────────────┘
```

See:

-   `architecture.md`
-   `design.md`
-   `requirements.md`
-   `agent.md`

## Proposed Technology Stack

Initial implementation:

-   Electron
-   React
-   TypeScript
-   Node.js
-   SQLite
-   Autocannon

Alternative desktop shell:

-   Tauri
-   React
-   Rust
-   SQLite

Electron is a practical starting point because the initial load-testing
engine ecosystem is heavily compatible with Node.js.

## Privacy

The core product is designed to work locally.

No cloud account is required for the basic workflow.

The target URL, test configuration, and results can remain on the user's
machine.

Optional cloud functionality can be introduced later without making
cloud execution a requirement.

## Safety

Only test systems that you own or are explicitly authorized to test.

Load testing can consume significant CPU, network bandwidth, server
resources, and application capacity.

LoadLab should provide warnings for aggressive configurations and avoid
features intended to bypass security controls or access restrictions.

## Project Status

Current status: **Architecture / MVP planning**

The first implementation target is:

``` text
Windows
  +
HTTP
  +
Autocannon
  +
Local execution
  +
Live dashboard
  +
SQLite history
```

## Suggested Repository Structure

``` text
loadlab/
├── apps/
│   └── desktop/
│
├── packages/
│   ├── core/
│   ├── engine-interface/
│   ├── engine-autocannon/
│   ├── models/
│   └── ui/
│
├── docs/
│   ├── architecture.md
│   ├── design.md
│   ├── requirements.md
│   └── agent.md
│
├── README.md
└── package.json
```

## Development Philosophy

Keep the MVP small.

Do not start by implementing every benchmark engine.

First make this workflow excellent:

``` text
Configure
   ↓
Run
   ↓
Observe
   ↓
Analyze
   ↓
Save
   ↓
Run again
```

Once that foundation is stable, additional engines and protocols can be
added through adapters.
