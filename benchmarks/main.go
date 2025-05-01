package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"sync/atomic"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	tc "github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
)

// how many rows per phase
const (
	nInserts      = 20_000
	nUpdates      = 20_000
	nDeletes      = 20_000
	workers       = 8     // concurrent goroutines
	progressEvery = 5_000 // heartbeat interval
)

// Sample data for more realistic test data
var (
	statuses    = []string{"active", "pending", "completed", "cancelled", "failed"}
	priorities  = []string{"low", "medium", "high", "urgent"}
	departments = []string{"sales", "marketing", "engineering", "support", "finance"}
)

type runResult struct {
	Name           string
	TotalOps       int
	Elapsed        time.Duration
	AvgLatencyNs   int64
	ThroughputOpsS float64
}

func main() {
	ctx := context.Background()

	// 1️⃣  Spin up a disposable Postgres container -------------
	pgContainer, err := postgres.RunContainer(ctx,
		tc.WithImage("postgres:16-alpine"),
		postgres.WithDatabase("bench"),
		postgres.WithUsername("bench"),
		postgres.WithPassword("bench"),
	)
	if err != nil {
		log.Fatalf("container start: %v", err)
	}
	defer pgContainer.Terminate(ctx)

	connStr, err := pgContainer.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		log.Fatalf("dsn: %v", err)
	}

	// 2️⃣  Connect and create test schema ----------------------
	pool, err := connectWithRetry(ctx, connStr, 15, time.Second) // ~15 s total
	if err != nil {
		log.Fatalf("pgxpool: %v", err)
	}
	defer pool.Close()

	sql := `
CREATE SCHEMA IF NOT EXISTS bench;
DROP TABLE IF EXISTS bench.items;
CREATE TABLE bench.items (
	id          SERIAL PRIMARY KEY,
	title       TEXT NOT NULL,
	description TEXT,
	status      TEXT NOT NULL,
	priority    TEXT NOT NULL,
	department  TEXT NOT NULL,
	amount      DECIMAL(10,2),
	created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
	updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
	metadata    JSONB,
	attributes  JSONB,
	CONSTRAINT valid_status CHECK (status IN ('active', 'pending', 'completed', 'cancelled', 'failed')),
	CONSTRAINT valid_priority CHECK (priority IN ('low', 'medium', 'high', 'urgent'))
);`
	if _, err := pool.Exec(ctx, sql); err != nil {
		log.Fatalf("init schema: %v", err)
	}

	// 3️⃣  Benchmark WITHOUT trigger ---------------------------
	noTrig := benchmarkPhase(ctx, pool, false)

	// 4️⃣  Add no-op trigger & Benchmark WITH trigger ----------------
	createNoOpTrigger(ctx, pool)
	withNoOpTrig := benchmarkPhase(ctx, pool, true)

	// 5️⃣  Add audit log trigger & Benchmark WITH audit trigger ----------------
	createAuditLogTable(ctx, pool)
	createAuditLogTrigger(ctx, pool)
	withAuditTrig := benchmarkPhase(ctx, pool, true)

	// 6️⃣  Print comparison ------------------------------------
	fmt.Println("=== PostgreSQL Trigger Benchmark ===")
	printResult(noTrig)
	printResult(withNoOpTrig)
	printResult(withAuditTrig)
	fmt.Printf("\nΔ throughput (no-op): %.2fx slower with trigger\n",
		noTrig.ThroughputOpsS/withNoOpTrig.ThroughputOpsS)
	fmt.Printf("Δ throughput (audit): %.2fx slower with trigger\n",
		noTrig.ThroughputOpsS/withAuditTrig.ThroughputOpsS)
}

// -------------------------------------------------------------------------
// Core benchmarking helpers
// -------------------------------------------------------------------------

func benchmarkPhase(ctx context.Context, pool *pgxpool.Pool, trigger bool) runResult {
	name := "no-trigger"
	if trigger {
		name = "with-trigger"
	}

	// truncate between phases so both start clean
	if _, err := pool.Exec(ctx, `TRUNCATE bench.items RESTART IDENTITY`); err != nil {
		log.Fatalf("truncate: %v", err)
	}

	var done int64 // atomic progress counter
	start := time.Now()

	// ------------------------------------------------- Inserts
	log.Printf("🔄  %s: inserts (%d rows)", name, nInserts)
	progress := func() {
		if atomic.AddInt64(&done, 1)%progressEvery == 0 {
			log.Printf("    %s: %d / %d ops", name, atomic.LoadInt64(&done), nInserts+nUpdates+nDeletes)
		}
	}
	runConcurrent(ctx, pool, nInserts, func(i int) {
		_, err := pool.Exec(ctx, `
			INSERT INTO bench.items(
				title, description, status, priority, department, 
				amount, metadata, attributes
			) VALUES($1, $2, $3, $4, $5, $6, $7, $8)`,
			randString(20),                           // title
			randString(100),                          // description
			statuses[rand.Intn(len(statuses))],       // status
			priorities[rand.Intn(len(priorities))],   // priority
			departments[rand.Intn(len(departments))], // department
			rand.Float64()*1000,                      // amount
			randJSONB(),                              // metadata
			randJSONB(),                              // attributes
		)
		if err != nil {
			log.Printf("insert error: %v", err)
		}
		progress()
	})

	// ------------------------------------------------- Updates
	log.Printf("🔄  %s: updates (%d rows)", name, nUpdates)
	runConcurrent(ctx, pool, nUpdates, func(i int) {
		_, err := pool.Exec(ctx, `
			UPDATE bench.items 
			SET 
				title = $1,
				description = $2,
				status = $3,
				priority = $4,
				amount = $5,
				metadata = $6,
				attributes = $7,
				updated_at = CURRENT_TIMESTAMP
			WHERE id = $8`,
			randString(20),                         // title
			randString(100),                        // description
			statuses[rand.Intn(len(statuses))],     // status
			priorities[rand.Intn(len(priorities))], // priority
			rand.Float64()*1000,                    // amount
			randJSONB(),                            // metadata
			randJSONB(),                            // attributes
			i,
		)
		if err != nil {
			log.Printf("update error: %v", err)
		}
		progress()
	})

	// ------------------------------------------------- Deletes
	log.Printf("🔄  %s: deletes (%d rows)", name, nDeletes)
	runConcurrent(ctx, pool, nDeletes, func(i int) {
		_, err := pool.Exec(ctx, `DELETE FROM bench.items WHERE id=$1`, i)
		if err != nil {
			log.Printf("delete error: %v", err)
		}
		progress()
	})

	elapsed := time.Since(start)
	totalOps := nInserts + nUpdates + nDeletes

	return runResult{
		Name:           name,
		TotalOps:       totalOps,
		Elapsed:        elapsed,
		AvgLatencyNs:   elapsed.Nanoseconds() / int64(totalOps),
		ThroughputOpsS: float64(totalOps) / elapsed.Seconds(),
	}
}

func createNoOpTrigger(ctx context.Context, pool *pgxpool.Pool) {
	ddl := `
CREATE OR REPLACE FUNCTION bench.audit_items()
RETURNS trigger LANGUAGE plpgsql AS
$$
BEGIN
	RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS items_audit_trigger ON bench.items;
CREATE TRIGGER items_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON bench.items
FOR EACH ROW EXECUTE FUNCTION bench.audit_items();`
	if _, err := pool.Exec(ctx, ddl); err != nil {
		log.Fatalf("create no-op trigger: %v", err)
	}
}

func createAuditLogTable(ctx context.Context, pool *pgxpool.Pool) {
	ddl := `
CREATE SCHEMA IF NOT EXISTS tight_analytics;
DROP TABLE IF EXISTS tight_analytics.event_log;
CREATE TABLE tight_analytics.event_log (
    id SERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    row_table_name TEXT NOT NULL,
    old_row JSONB,
    new_row JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);`
	if _, err := pool.Exec(ctx, ddl); err != nil {
		log.Fatalf("create audit log table: %v", err)
	}
}

func createAuditLogTrigger(ctx context.Context, pool *pgxpool.Pool) {
	ddl := `
CREATE OR REPLACE FUNCTION bench.audit_items()
RETURNS trigger LANGUAGE plpgsql AS
$$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO tight_analytics.event_log (
            event_type,
            row_table_name,
            old_row,
            new_row
        ) VALUES (
            'insert',
            TG_TABLE_NAME,
            NULL,
            to_jsonb(NEW)
        );
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO tight_analytics.event_log (
            event_type,
            row_table_name,
            old_row,
            new_row
        ) VALUES (
            'update',
            TG_TABLE_NAME,
            to_jsonb(OLD),
            to_jsonb(NEW)
        );
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO tight_analytics.event_log (
            event_type,
            row_table_name,
            old_row,
            new_row
        ) VALUES (
            'delete',
            TG_TABLE_NAME,
            to_jsonb(OLD),
            NULL
        );
    END IF;
    
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS items_audit_trigger ON bench.items;
CREATE TRIGGER items_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON bench.items
FOR EACH ROW EXECUTE FUNCTION bench.audit_items();`
	if _, err := pool.Exec(ctx, ddl); err != nil {
		log.Fatalf("create audit log trigger: %v", err)
	}
}

// -------------------------------------------------------------------------
// Utility helpers
// -------------------------------------------------------------------------

func waitAll(ch chan struct{}) {
	for i := 0; i < cap(ch); i++ {
		ch <- struct{}{}
	}
	// drain for next use
	for i := 0; i < cap(ch); i++ {
		<-ch
	}
}

// trivial random ascii payload
const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

func randString(n int) string {
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}

func randJSONB() []byte {
	// Generate random JSONB data
	metadata := map[string]interface{}{
		"tags":         []string{randString(5), randString(5), randString(5)},
		"source":       randString(8),
		"version":      rand.Intn(10),
		"is_processed": rand.Intn(2) == 1,
		"score":        rand.Float64() * 100,
	}

	attributes := map[string]interface{}{
		"category":     departments[rand.Intn(len(departments))],
		"complexity":   rand.Intn(5) + 1,
		"dependencies": []string{randString(8), randString(8)},
		"settings": map[string]interface{}{
			"notifications": rand.Intn(2) == 1,
			"auto_approve":  rand.Intn(2) == 1,
		},
	}

	jsonData := map[string]interface{}{
		"metadata":   metadata,
		"attributes": attributes,
	}

	jsonBytes, _ := json.Marshal(jsonData)
	return jsonBytes
}

func printResult(r runResult) {
	fmt.Printf("[%s] ops=%d  elapsed=%v  avg=%6.1f µs  throughput=%.0f ops/s\n",
		r.Name, r.TotalOps, r.Elapsed, float64(r.AvgLatencyNs)/1_000.0, r.ThroughputOpsS)
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

func runConcurrent(ctx context.Context, pool *pgxpool.Pool, n int, fn func(int)) {
	wg := make(chan struct{}, workers)
	for i := 0; i < n; i++ {
		wg <- struct{}{}
		go func(i int) {
			defer func() { <-wg }()
			fn(i)
		}(i)
	}
	waitAll(wg)
}
