package agent

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/typeeng/tight-agent/internal/config"
	"github.com/typeeng/tight-agent/internal/db"
	"github.com/typeeng/tight-agent/internal/evtxfrm"
	"github.com/typeeng/tight-agent/internal/logger"
)

type Agent struct {
	db     *sql.DB
	cfg    *config.AgentConfig
	logger *slog.Logger
}

func NewAgent(ctx context.Context, db *sql.DB) *Agent {
	cfg := config.ConfigFromContext(ctx)
	logger := logger.Logger()

	return &Agent{
		db:     db,
		cfg:    cfg,
		logger: logger,
	}
}

// Start begins the event processing loop
func (a *Agent) Start(ctx context.Context) error {
	ticker := time.NewTicker(a.cfg.FetchInterval)
	defer ticker.Stop()

	a.logger.Info("starting event processing agent",
		"batch_size", a.cfg.BatchSize,
		"interval", a.cfg.FetchInterval)

	schema, err := db.GetSchema(ctx, a.db)
	if err != nil {
		a.logger.Error("failed to get schema", "error", err)
		return err
	}
	schemaJSON, err := json.Marshal(schema)
	if err != nil {
		a.logger.Error("failed to marshal schema", "error", err)
		return err
	}
	fmt.Println(string(schemaJSON))

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			if err := a.processEventBatch(ctx); err != nil {
				a.logger.Error("error processing event batch", "error", err)
			}
		}
	}
}

// processEventBatch fetches, processes, and deletes a batch of events
func (a *Agent) processEventBatch(ctx context.Context) error {
	a.logger.Info("checking for events to process")
	// Fetch db events with lock
	dbEvents, tx, err := db.FetchDBEvents(ctx, a.db)
	if err != nil {
		a.logger.Error("failed to fetch events", "error", err)
		return err
	}

	if len(dbEvents) == 0 {
		a.logger.Info("no events to process")
		// No events to process, commit or rollback the empty transaction
		if tx != nil {
			tx.Rollback()
		}
		return nil
	}

	a.logger.Info("fetched events for processing", "count", len(dbEvents))

	// Track events to send to API and events to flush from DB
	eventIds := make([]int64, len(dbEvents))
	var processedEvents []*evtxfrm.ProcessedEvent
	for i, dbEvent := range dbEvents {
		eventIds[i] = dbEvent.ID
		// TODO Event processing logic
		processedEvent, err := evtxfrm.ProcessEvent(&dbEvent, a.cfg.EventStreamingConfig)
		if err != nil {
			a.logger.Error("failed to process event", "error", err)
			// TODO Continue or what?
			continue
		}

		a.logger.Info("processed event", "event_id", dbEvent.ID, "event_type", dbEvent.EventType, "table", dbEvent.RowTableName, "processed_event", processedEvent)
		// Add to send list and mark for deletion
		processedEvents = append(processedEvents, processedEvent)
	}

	// Only send events if there are any to send
	if len(processedEvents) > 0 {
		a.logger.Info("sending events to API", "count", len(processedEvents))
		// TODO
	} else {
		a.logger.Info("no events to send to API (all excluded)")
	}

	// Flush all processed events, including excluded ones
	a.logger.Info("flushing processed events", "count", len(eventIds))
	if err := db.FlushDBEvents(ctx, tx, eventIds); err != nil {
		tx.Rollback()
		a.logger.Error("failed to delete processed events", "error", err)
		return err
	}
	a.logger.Info("flushed processed events", "count", len(eventIds))

	return nil
}
