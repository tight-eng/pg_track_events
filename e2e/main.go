package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	tc "github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/typeeng/pg_track_events/agent/pkg/agent"
	"github.com/typeeng/pg_track_events/agent/pkg/eventmodels"
)

type Scenario struct {
	Name       string
	SchemaPath string
	ConfigPath string
	EventsPath string
}

func main() {
	ctx := context.Background()

	// 1️⃣  Spin up a disposable Postgres container
	pgContainer, err := postgres.RunContainer(ctx,
		tc.WithImage("postgres:16-alpine"),
		postgres.WithDatabase("e2e"),
		postgres.WithUsername("e2e"),
		postgres.WithPassword("e2e"),
	)
	if err != nil {
		log.Fatalf("container start: %v", err)
	}
	defer pgContainer.Terminate(ctx)

	connStr, err := pgContainer.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		log.Fatalf("dsn: %v", err)
	}

	// 2️⃣  Connect to the database
	pool, err := connectWithRetry(ctx, connStr, 15, time.Second)
	if err != nil {
		log.Fatalf("pgxpool: %v", err)
	}
	defer pool.Close()

	// 3️⃣  Find and run all scenarios
	scenarios, err := findScenarios("scenarios")
	if err != nil {
		log.Fatalf("find scenarios: %v", err)
	}

	for _, scenario := range scenarios {
		log.Printf("Running scenario: %s", scenario.Name)
		if err := runScenario(ctx, pool, scenario); err != nil {
			log.Printf("Error in scenario %s: %v", scenario.Name, err)
		}
	}
}

func findScenarios(baseDir string) ([]Scenario, error) {
	var scenarios []Scenario

	err := filepath.Walk(baseDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if !info.IsDir() {
			return nil
		}

		// Check if this directory contains a scenario
		schemaPath := filepath.Join(path, "schema.sql")
		configPath := filepath.Join(path, "pg_track_events.config.yaml")
		eventsPath := filepath.Join(path, "db_events.ndjson")

		if _, err := os.Stat(schemaPath); err != nil {
			return nil
		}
		if _, err := os.Stat(configPath); err != nil {
			return nil
		}
		if _, err := os.Stat(eventsPath); err != nil {
			return nil
		}

		scenarios = append(scenarios, Scenario{
			Name:       filepath.Base(path),
			SchemaPath: schemaPath,
			ConfigPath: configPath,
			EventsPath: eventsPath,
		})

		return nil
	})

	return scenarios, err
}

func runScenario(ctx context.Context, pool *pgxpool.Pool, scenario Scenario) error {
	// 1. Apply schema
	schemaSQL, err := os.ReadFile(scenario.SchemaPath)
	if err != nil {
		return fmt.Errorf("read schema: %v", err)
	}

	if _, err := pool.Exec(ctx, string(schemaSQL)); err != nil {
		return fmt.Errorf("apply schema: %v", err)
	}
	log.Printf("Applied schema for scenario %s", scenario.Name)

	// 2. Set up environment for agent
	// Set the config file path in environment
	os.Setenv("EVENTS_CONFIG_PATH", scenario.ConfigPath)

	// Set the database URL in environment
	dbURL := fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=disable",
		pool.Config().ConnConfig.User,
		pool.Config().ConnConfig.Password,
		pool.Config().ConnConfig.Host,
		pool.Config().ConnConfig.Port,
		pool.Config().ConnConfig.Database,
	)
	log.Printf("Setting DATABASE_URL to: %s", dbURL)
	os.Setenv("DATABASE_URL", dbURL)

	// Run CLI init after database is ready
	if err := runCLIInit(scenario.ConfigPath); err != nil {
		return fmt.Errorf("failed to run CLI init: %v", err)
	}
	log.Printf("Successfully ran CLI init for scenario %s", scenario.Name)

	// 3. Setup and start agent in a goroutine
	agentDone := make(chan struct{})
	// TODO Set the buffer size to the number of events in the scenario
	dbEventChan := make(chan *eventmodels.DBEvent, 10_000)
	processedEventChan := make(chan *eventmodels.ProcessedEvent, 10_000)
	go func() {
		defer close(agentDone)

		eventAgent, err := agent.NewAgent(ctx, pool, agent.WithE2EDBEventChan(dbEventChan), agent.WithE2EProcessedEventChan(processedEventChan))
		if err != nil {
			log.Fatalf("initialize agent: %v", err)
		}

		log.Printf("Starting agent for scenario %s", scenario.Name)
		if err := eventAgent.Start(ctx); err != nil && err != context.Canceled {
			log.Printf("Agent error: %v", err)
		}
		log.Printf("Agent completed for scenario %s", scenario.Name)
	}()

	// 4. Apply events
	eventsFile, err := os.Open(scenario.EventsPath)
	if err != nil {
		return fmt.Errorf("open events: %v", err)
	}
	defer eventsFile.Close()

	// Create a worker pool to apply events
	workers := 1
	events := make(chan eventmodels.DBEvent, workers)
	var wg sync.WaitGroup

	// Start workers
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for event := range events {
				if err := processEvent(ctx, pool, event); err != nil {
					log.Printf("Error processing event %d: %v", event.ID, err)
				} else {
					log.Printf("Successfully processed event %d", event.ID)
				}
			}
		}()
	}

	// Read and process events
	scanner := bufio.NewScanner(eventsFile)
	for scanner.Scan() {
		var event eventmodels.DBEvent
		if err := json.Unmarshal(scanner.Bytes(), &event); err != nil {
			log.Printf("Error unmarshaling event: %v", err)
			continue
		}
		events <- event
	}
	if err := scanner.Err(); err != nil {
		return fmt.Errorf("scanner error: %v", err)
	}
	close(events)

	// Wait for all workers to complete
	wg.Wait()
	log.Printf("All events processed for scenario %s", scenario.Name)

	// Wait for agent to complete
	<-agentDone

	// Clean up between scenarios
	if _, err := pool.Exec(ctx, "DROP SCHEMA public CASCADE"); err != nil {
		log.Printf("Warning: failed to clean up schema: %v", err)
	}

	return nil
}

func processEvent(ctx context.Context, pool *pgxpool.Pool, event eventmodels.DBEvent) error {
	switch event.EventType {
	case eventmodels.EventTypeInsert:
		return processInsert(ctx, pool, event)
	case eventmodels.EventTypeUpdate:
		return processUpdate(ctx, pool, event)
	case eventmodels.EventTypeDelete:
		return processDelete(ctx, pool, event)
	default:
		return fmt.Errorf("unknown event type: %s", event.EventType)
	}
}

func processInsert(ctx context.Context, pool *pgxpool.Pool, event eventmodels.DBEvent) error {
	var data map[string]interface{}
	if err := json.Unmarshal(event.NewRow, &data); err != nil {
		return fmt.Errorf("unmarshal new row: %v", err)
	}

	// Build the INSERT query dynamically based on the table and data
	columns := make([]string, 0, len(data))
	values := make([]interface{}, 0, len(data))
	placeholders := make([]string, 0, len(data))
	i := 1
	for col, val := range data {
		columns = append(columns, col)
		values = append(values, val)
		placeholders = append(placeholders, fmt.Sprintf("$%d", i))
		i++
	}

	query := fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s)",
		event.RowTableName,
		strings.Join(columns, ", "),
		strings.Join(placeholders, ", "),
	)

	_, err := pool.Exec(ctx, query, values...)
	return err
}

func processUpdate(ctx context.Context, pool *pgxpool.Pool, event eventmodels.DBEvent) error {
	var newData map[string]interface{}
	if err := json.Unmarshal(event.NewRow, &newData); err != nil {
		return fmt.Errorf("unmarshal new row: %v", err)
	}

	// Build the UPDATE query dynamically
	sets := make([]string, 0, len(newData))
	values := make([]interface{}, 0, len(newData))
	i := 1
	for col, val := range newData {
		if col == "id" {
			continue // Skip ID as it's used in WHERE clause
		}
		sets = append(sets, fmt.Sprintf("%s = $%d", col, i))
		values = append(values, val)
		i++
	}

	// Add ID to values for WHERE clause
	values = append(values, newData["id"])

	query := fmt.Sprintf("UPDATE %s SET %s WHERE id = $%d",
		event.RowTableName,
		strings.Join(sets, ", "),
		i,
	)

	_, err := pool.Exec(ctx, query, values...)
	return err
}

func processDelete(ctx context.Context, pool *pgxpool.Pool, event eventmodels.DBEvent) error {
	var data map[string]interface{}
	if err := json.Unmarshal(event.OldRow, &data); err != nil {
		return fmt.Errorf("unmarshal old row: %v", err)
	}

	query := fmt.Sprintf("DELETE FROM %s WHERE id = $1", event.RowTableName)
	_, err := pool.Exec(ctx, query, data["id"])
	return err
}

func connectWithRetry(ctx context.Context, dsn string, attempts int, pause time.Duration) (*pgxpool.Pool, error) {
	var pool *pgxpool.Pool
	var err error
	for i := 1; i <= attempts; i++ {
		pool, err = pgxpool.New(ctx, dsn)
		if err == nil {
			// make sure the server is actually ready
			if err = pool.Ping(ctx); err == nil {
				return pool, nil // 🎉
			}
			pool.Close()
		}
		time.Sleep(pause)
	}
	return nil, fmt.Errorf("postgres never became ready: %w", err)
}

func runCLIInit(configPath string) error {
	// Convert to absolute path if needed
	absConfigPath, err := filepath.Abs(configPath)
	if err != nil {
		return fmt.Errorf("failed to get absolute path: %v", err)
	}

	cmd := exec.Command("bun", "run", "index.ts", "init", "--reset", absConfigPath)

	// Set working directory to ../cli
	cmd.Dir = "../cli"

	// Set DATABASE_URL environment variable
	cmd.Env = append(os.Environ(), fmt.Sprintf("DATABASE_URL=%s", os.Getenv("TIGHT_DATABASE_URL")))

	// Capture and display output
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	return cmd.Run()
}
