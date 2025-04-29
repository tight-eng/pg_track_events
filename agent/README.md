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

## Stopping the Agent

The agent will gracefully shut down when it receives a SIGINT or SIGTERM signal. 