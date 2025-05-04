package db

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/typeeng/pg_track_events/agent/internal/config"
	"github.com/typeeng/pg_track_events/agent/internal/db/queries"
	"github.com/typeeng/pg_track_events/agent/internal/logger"
	"github.com/typeeng/pg_track_events/agent/pkg/eventmodels"
	"github.com/typeeng/pg_track_events/agent/pkg/schemas"
)

func NewDB(ctx context.Context) (*pgxpool.Pool, error) {
	cfg := config.ConfigFromContext(ctx)

	poolConfig, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("unable to parse connection string: %w", err)
	}

	if cfg.PgxPreferSimpleProtocol {
		logger.Logger().Info("using pgx simple protocol mode")
		poolConfig.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	}

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("unable to create connection pool: %w", err)
	}

	return pool, nil
}

// FetchDBEvents retrieves a batch of events from the event_log table
// using SELECT FOR UPDATE SKIP LOCKED to implement a queue pattern.
// It returns the events and the pgx transaction which must be committed
// or rolled back by the caller.
func FetchDBEvents(ctx context.Context, pool *pgxpool.Pool) ([]*eventmodels.DBEvent, pgx.Tx, error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to begin transaction: %w", err)
	}

	cfg := config.ConfigFromContext(ctx)

	// Construct the fully qualified table name using schema and table from config
	tableName := fmt.Sprintf("%s.%s", cfg.InternalSchemaName, cfg.EventLogTableName)

	query := fmt.Sprintf(`
		SELECT id, event_type, row_table_name, logged_at, retries, last_error, last_retry_at, next_retry_at, old_row, new_row
		FROM %s
		WHERE (next_retry_at IS NULL OR next_retry_at < $1)
		ORDER BY id ASC
		FOR UPDATE SKIP LOCKED
		LIMIT $2
	`, tableName)

	rows, err := tx.Query(ctx, query, time.Now(), cfg.BatchSize)
	if err != nil {
		tx.Rollback(ctx)
		return nil, nil, fmt.Errorf("failed to query events: %w", err)
	}
	defer rows.Close()

	var events []*eventmodels.DBEvent
	for rows.Next() {
		var event eventmodels.DBEvent
		var eventTypeStr string
		var oldRow, newRow pgtype.Text

		if err := rows.Scan(
			&event.ID,
			&eventTypeStr,
			&event.RowTableName,
			&event.LoggedAt,
			&event.Retries,
			&event.LastError,
			&event.LastRetryAt,
			&event.NextRetryAt,
			&oldRow,
			&newRow,
		); err != nil {
			tx.Rollback(ctx)
			return nil, nil, fmt.Errorf("failed to scan event: %w", err)
		}

		event.EventType = eventmodels.DBEventType(eventTypeStr)

		if oldRow.Valid {
			event.OldRow = json.RawMessage(oldRow.String)
		}

		if newRow.Valid {
			event.NewRow = json.RawMessage(newRow.String)
		}

		events = append(events, &event)
	}

	if err := rows.Err(); err != nil {
		tx.Rollback(ctx)
		return nil, nil, fmt.Errorf("error iterating event rows: %w", err)
	}

	return events, tx, nil
}

func UpdateDBEvents(ctx context.Context, tx pgx.Tx, updates []*eventmodels.DBEventUpdate) error {
	if len(updates) == 0 {
		return nil
	}

	cfg := config.ConfigFromContext(ctx)

	tableName := fmt.Sprintf("%s.%s", cfg.InternalSchemaName, cfg.EventLogTableName)

	// Prepare batch for multiple updates
	batch := &pgx.Batch{}

	// Create query for each update
	baseQuery := fmt.Sprintf(`
		UPDATE %s
		SET retries = $1, last_error = $2, last_retry_at = $3, next_retry_at = $4
		WHERE id = $5
	`, tableName)

	// Add each update to the batch
	for _, update := range updates {
		batch.Queue(baseQuery, update.Retries, update.LastError, update.LastRetryAt, update.NextRetryAt, update.ID)
	}

	// Execute all updates as a batch
	results := tx.SendBatch(ctx, batch)
	defer results.Close()

	// Check for errors
	for i := 0; i < len(updates); i++ {
		_, err := results.Exec()
		if err != nil {
			return fmt.Errorf("failed to update event (index %d): %w", i, err)
		}
	}

	return nil
}

// FlushDBEvents removes processed events from the event_log table
// using the transaction obtained from FetchDBEvents
func FlushDBEvents(ctx context.Context, tx pgx.Tx, eventIDs []int64) error {
	if len(eventIDs) == 0 {
		return tx.Commit(ctx)
	}

	cfg := config.ConfigFromContext(ctx)

	// Construct the fully qualified table name using schema and table from config
	tableName := fmt.Sprintf("%s.%s", cfg.InternalSchemaName, cfg.EventLogTableName)

	query := fmt.Sprintf("DELETE FROM %s WHERE id = ANY($1)", tableName)
	_, err := tx.Exec(ctx, query, eventIDs)
	if err != nil {
		tx.Rollback(ctx)
		return fmt.Errorf("failed to delete events: %w", err)
	}

	return nil
}

// GetSchema retrieves the database schema using the provided SQL query
func GetSchema(ctx context.Context, pool *pgxpool.Pool) (schemas.PostgresqlTableSchemaList, error) {
	// Execute the query using the embedded SQL content
	rows, err := pool.Query(ctx, queries.IntrospectSQL)
	if err != nil {
		return nil, fmt.Errorf("failed to execute schema query: %w", err)
	}
	defer rows.Close()

	// Read the JSON result
	var schemaJSON string
	if !rows.Next() {
		return nil, fmt.Errorf("no schema data returned")
	}
	if err := rows.Scan(&schemaJSON); err != nil {
		return nil, fmt.Errorf("failed to scan schema JSON: %w", err)
	}

	// Unmarshal the JSON into our schema structs
	var schemas schemas.PostgresqlTableSchemaList
	if err := json.Unmarshal([]byte(schemaJSON), &schemas); err != nil {
		return nil, fmt.Errorf("failed to unmarshal schema JSON: %w", err)
	}

	return schemas, nil
}
