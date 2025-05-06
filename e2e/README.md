# E2E Testing Framework

This directory contains an end-to-end testing framework for the TightDB project. The framework allows you to define test scenarios that simulate real-world database operations and verify the behavior of the analytics agent.

## Structure

Each test scenario is defined in its own subdirectory under `scenarios/`. A scenario consists of three files:

1. `schema.sql` - Defines the database schema for the test
2. `pg_track_events.config.yaml` - Configuration for the analytics agent
3. `db_events.ndjson` - A sequence of database events to simulate

## Running Tests

To run the E2E tests:

```bash
cd e2e
go run main.go
```

The test runner will:

1. Start a new PostgreSQL container
2. Apply the schema from each scenario
3. Start the analytics agent
4. Apply the database events
5. Verify the results

## Creating New Scenarios

To create a new test scenario:

1. Create a new directory under `scenarios/`
2. Add the three required files:
   - `schema.sql` - Your test database schema
   - `pg_track_events.config.yaml` - Agent configuration
   - `db_events.ndjson` - Test events

## Example Scenario

See `scenarios/basic/` for a simple example that:

- Creates users and orders tables
- Inserts sample data
- Updates order statuses
- Deletes a user
