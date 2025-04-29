# TightDB Agent

The TightDB Agent is a service that processes database events from a PostgreSQL database and forwards them to configured destinations. It works by reading events from a dedicated event log table, processing them, and then deleting the processed events.

## Setup

### Prerequisites

- Go 1.22.4 or higher
- PostgreSQL database
- API credentials

### Installation

Clone the repository:

```bash
git clone https://github.com/typeeng/tight-agent.git
cd tight-agent
```

Install dependencies:

```bash
go mod download
```

Run the agent:

```bash
go run main.go
```

### Build WASM lib

```bash
GOOS=js GOARCH=wasm go build -o bin/wasmlib/bin.wasm ./pkg/wasmlib/main.go
cp "$(go env GOROOT)/lib/wasm/wasm_exec.js" bin/wasmlib
```

To test out the built wasm, serve the directory with `npx http-server`

## Stopping the Agent

The agent will gracefully shut down when it receives a SIGINT or SIGTERM signal.
