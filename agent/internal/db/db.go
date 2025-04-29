package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/typeeng/tight-agent/internal/config"
)

type DBEventType string

const (
	EventTypeInsert DBEventType = "insert"
	EventTypeUpdate DBEventType = "update"
	EventTypeDelete DBEventType = "delete"
)

type DBEvent struct {
	ID           int64           `json:"id"`
	EventType    DBEventType     `json:"event_type"`
	RowTableName string          `json:"row_table_name"`
	LoggedAt     time.Time       `json:"logged_at"`
	OldRow       json.RawMessage `json:"old_row,omitempty"`
	NewRow       json.RawMessage `json:"new_row,omitempty"`
}

func NewDB(ctx context.Context) (*sql.DB, error) {
	cfg := config.ConfigFromContext(ctx)

	db, err := sql.Open("pgx", cfg.DatabaseURL)
	if err != nil {
		return nil, err
	}

	return db, nil
}

// FetchDBEvents retrieves a batch of events from the event_log table
// using SELECT FOR UPDATE SKIP LOCKED to implement a queue pattern.
// It returns the events and the active transaction which must be committed
// or rolled back by the caller.
func FetchDBEvents(ctx context.Context, db *sql.DB) ([]DBEvent, *sql.Tx, error) {
	tx, err := db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return nil, nil, fmt.Errorf("failed to begin transaction: %w", err)
	}

	cfg := config.ConfigFromContext(ctx)

	// Construct the fully qualified table name using schema and table from config
	tableName := fmt.Sprintf("%s.%s", cfg.SchemaName, cfg.EventLogTableName)

	query := fmt.Sprintf(`
		SELECT id, event_type, row_table_name, logged_at, old_row, new_row
		FROM %s
		ORDER BY id ASC
		FOR UPDATE SKIP LOCKED
		LIMIT $1
	`, tableName)

	rows, err := tx.QueryContext(ctx, query, cfg.BatchSize)
	if err != nil {
		tx.Rollback()
		return nil, nil, fmt.Errorf("failed to query events: %w", err)
	}
	defer rows.Close()

	var events []DBEvent
	for rows.Next() {
		var event DBEvent
		var eventTypeStr string
		var oldRow, newRow sql.NullString

		if err := rows.Scan(
			&event.ID,
			&eventTypeStr,
			&event.RowTableName,
			&event.LoggedAt,
			&oldRow,
			&newRow,
		); err != nil {
			tx.Rollback()
			return nil, nil, fmt.Errorf("failed to scan event: %w", err)
		}

		event.EventType = DBEventType(eventTypeStr)

		if oldRow.Valid {
			event.OldRow = json.RawMessage(oldRow.String)
		}

		if newRow.Valid {
			event.NewRow = json.RawMessage(newRow.String)
		}

		events = append(events, event)
	}

	if err := rows.Err(); err != nil {
		tx.Rollback()
		return nil, nil, fmt.Errorf("error iterating event rows: %w", err)
	}

	return events, tx, nil
}

// FlushDBEvents removes processed events from the event_log table
// using the transaction obtained from FetchEvents
func FlushDBEvents(ctx context.Context, tx *sql.Tx, eventIDs []int64) error {
	if len(eventIDs) == 0 {
		return tx.Commit()
	}

	// TODO Do we need this just in case?
	defer tx.Rollback()

	cfg := config.ConfigFromContext(ctx)

	// Construct the fully qualified table name using schema and table from config
	tableName := fmt.Sprintf("%s.%s", cfg.SchemaName, cfg.EventLogTableName)

	query := fmt.Sprintf("DELETE FROM %s WHERE id = ANY($1)", tableName)
	_, err := tx.ExecContext(ctx, query, eventIDs)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to delete events: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}
