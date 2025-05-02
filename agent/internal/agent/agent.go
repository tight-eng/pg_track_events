package agent

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"path/filepath"
	"time"

	"github.com/typeeng/tight-agent/internal/config"
	"github.com/typeeng/tight-agent/internal/db"
	"github.com/typeeng/tight-agent/internal/evtxfrm"
	"github.com/typeeng/tight-agent/internal/logger"
	"github.com/typeeng/tight-agent/pkg/eventmodels"
	"github.com/typeeng/tight-agent/pkg/schemas"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
)

type Agent struct {
	db                         *sql.DB
	cfg                        *config.AgentConfig
	logger                     *slog.Logger
	schema                     schemas.PostgresqlTableSchemaList
	schemaPbDescriptor         protoreflect.FileDescriptor
	schemaPbPkgName            *string
	strictSchema               bool
	processedEventDestinations []config.InitializedProcessedEventDestination
}

func NewAgent(ctx context.Context, db *sql.DB) (*Agent, error) {
	cfg := config.ConfigFromContext(ctx)
	logger := logger.Logger()

	a := &Agent{
		db:              db,
		cfg:             cfg,
		logger:          logger,
		schemaPbPkgName: proto.String("db"),
		strictSchema:    true,
	}

	initializedDestinations, err := a.cfg.EventStreamingConfig.GetInitializedDestinations(logger)
	if err != nil {
		return nil, err
	}
	a.processedEventDestinations = initializedDestinations

	return a, nil
}

// Start begins the event processing loop
func (a *Agent) Start(ctx context.Context) error {
	ticker := time.NewTicker(a.cfg.FetchInterval)
	defer ticker.Stop()

	a.logger.Info("starting event processing agent",
		"batch_size", a.cfg.BatchSize,
		"interval", a.cfg.FetchInterval,
		"schema_name", a.cfg.InternalSchemaName,
		"strict_schema", a.strictSchema,
	)

	// TODO Monitor for schema changes
	if a.strictSchema {
		a.logger.Info("fetching schema")
		if a.schemaPbPkgName == nil {
			return fmt.Errorf("schema package name not set")
		}
		var err error
		a.schema, err = db.GetSchema(ctx, a.db)
		if err != nil {
			a.logger.Error("failed to get schema", "error", err)
			return err
		}

		a.logger.Info("loaded schema", "tables", len(a.schema))

		a.schema = a.schema.ApplyIgnoresToSchema(a.cfg.EventStreamingConfig.Ignore)
		a.logger.Info("applied ignores to schema", "tables", len(a.schema))

		a.schemaPbDescriptor, err = a.schema.GeneratePbDescriptorForTables(*a.schemaPbPkgName, fmt.Sprintf("%s.*", a.cfg.DefaultSchemaName))
		if err != nil {
			a.logger.Error("failed to generate protobuf descriptor", "error", err)
			return err
		}

		a.logger.Info("generated protobuf descriptor for schema")

		if err := a.cfg.EventStreamingConfig.Validate(a.schemaPbPkgName, a.schemaPbDescriptor); err != nil {
			a.logger.Error("failed to validate event streaming config against schema", "error", err)
			return err
		}
		a.logger.Info("validated event streaming config against schema")
	}

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			// Process events until we don't get a full batch
			for {
				fullBatch, err := a.processEventBatch(ctx)
				if err != nil {
					a.logger.Error("error processing event batch", "error", err)
					break
				}
				if !fullBatch {
					break
				}
				// If we got a full batch, continue processing immediately
				a.logger.Info("processed full batch, checking for more events")
			}
		}
	}
}

// processEventBatch fetches, processes, and deletes a batch of events
// Returns true if a full batch was processed (indicating there might be more events)
func (a *Agent) processEventBatch(ctx context.Context) (bool, error) {
	a.logger.Info("checking for events to process")
	// Fetch db events with lock
	dbEvents, tx, err := db.FetchDBEvents(ctx, a.db)
	if err != nil {
		a.logger.Error("failed to fetch events", "error", err)
		return false, err
	}

	if len(dbEvents) == 0 {
		a.logger.Info("no events to process")
		// No events to process, commit or rollback the empty transaction
		if tx != nil {
			tx.Rollback()
		}
		return false, nil
	}

	a.logger.Info("fetched events for processing", "count", len(dbEvents))

	// Track events to send to API and events to flush from DB
	eventIds := make([]int64, len(dbEvents))
	var processedEvents []*eventmodels.ProcessedEvent
	for i, dbEvent := range dbEvents {
		eventIds[i] = dbEvent.ID
		// Process event with protobuf support
		processedEvent, err := evtxfrm.ProcessEvent(&dbEvent, a.cfg.EventStreamingConfig, a.schemaPbPkgName, a.schemaPbDescriptor)
		if err != nil {
			a.logger.Error("failed to process event", "error", err)
			// TODO Think about how to handle retries, etc.
			tx.Rollback()
			return false, err
		}

		if processedEvent != nil {
			a.logger.Info("processed event", "event_id", dbEvent.ID, "event_type", dbEvent.EventType, "table", dbEvent.RowTableName, "processed_event", processedEvent)
			// Add to send list and mark for deletion
			processedEvents = append(processedEvents, processedEvent)
		} else {
			a.logger.Info("skipping event", "event_id", dbEvent.ID, "event_type", dbEvent.EventType, "table", dbEvent.RowTableName)
		}
	}

	// Only send events if there are any to send
	if len(processedEvents) > 0 {
		a.logger.Info("sending processed events to destinations", "count", len(processedEvents))
		if err := a.sendProcessedEvents(ctx, processedEvents); err != nil {
			tx.Rollback()
			a.logger.Error("failed to send processed events to destinations", "error", err)
			return false, err
		}
		a.logger.Info("successfully sent processed events to destinations", "count", len(processedEvents))
	} else {
		a.logger.Info("no events to send to destinations (all raw events excluded)")
	}

	// Flush all processed events, including excluded ones
	a.logger.Info("flushing processed events", "count", len(eventIds))
	if err := db.FlushDBEvents(ctx, tx, eventIds); err != nil {
		tx.Rollback()
		a.logger.Error("failed to delete processed events", "error", err)
		return false, err
	}
	a.logger.Info("flushed processed events", "count", len(eventIds))

	// Return true if we processed a full batch (indicating there might be more events)
	return len(dbEvents) == a.cfg.BatchSize, nil
}

func (a *Agent) sendProcessedEvents(ctx context.Context, events []*eventmodels.ProcessedEvent) error {
	a.logger.Info("sending events to destinations", "count", len(events))
	for _, destination := range a.processedEventDestinations {
		filteredEvents := events
		if destination.Filter != "*" {
			filteredEvents = a.filterEvents(events, destination.Filter)
		}
		if len(filteredEvents) == 0 {
			a.logger.Info("after applying filter, no events to send to destination", "destination", destination.Destination)
			continue
		}
		a.logger.Info("sending events to destination", "destination", destination.Kind, "count", len(filteredEvents))
		if err := destination.Destination.SendBatch(ctx, filteredEvents); err != nil {
			a.logger.Error("failed to send events to destination", "error", err)
			return err
		}
		a.logger.Info("successfully sent events to destination", "destination", destination.Kind, "count", len(filteredEvents))
	}
	return nil
}

func (a *Agent) filterEvents(events []*eventmodels.ProcessedEvent, filter string) []*eventmodels.ProcessedEvent {
	filteredEvents := make([]*eventmodels.ProcessedEvent, 0, len(events))
	for _, event := range events {
		matched, err := filepath.Match(filter, event.Name)
		if err != nil {
			// If the pattern is invalid, skip filtering for this event (error should've been caught by Validate)
			a.logger.Error("(unexpected, skipping event) invalid destination filter pattern", "error", err)
			continue
		}
		if matched {
			filteredEvents = append(filteredEvents, event)
		}
	}
	return filteredEvents
}
