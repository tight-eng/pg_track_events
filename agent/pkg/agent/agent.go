package agent

import (
	"context"
	"fmt"
	"log/slog"
	"path/filepath"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/typeeng/pg_track_events/agent/internal/config"
	"github.com/typeeng/pg_track_events/agent/internal/db"
	"github.com/typeeng/pg_track_events/agent/internal/evtxfrm"
	"github.com/typeeng/pg_track_events/agent/internal/logger"
	"github.com/typeeng/pg_track_events/agent/pkg/destinations"
	"github.com/typeeng/pg_track_events/agent/pkg/eventmodels"
	"github.com/typeeng/pg_track_events/agent/pkg/schemas"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
)

type Agent struct {
	db                         *pgxpool.Pool
	cfg                        *config.AgentConfig
	logger                     *slog.Logger
	schema                     schemas.PostgresqlTableSchemaList
	schemaPbDescriptor         protoreflect.FileDescriptor
	schemaPbPkgName            *string
	strictSchema               bool
	processedEventDestinations []config.InitializedProcessedEventDestination
	dbEventDestinations        []config.InitializedDBEventDestination
}

type AgentOption func(*Agent)

func WithE2EProcessedEventChan(ch chan<- *eventmodels.ProcessedEvent) AgentOption {
	return func(a *Agent) {
		a.cfg.EventStreamingConfig.E2eProcessedEventChan = ch
	}
}

func WithE2EDBEventChan(ch chan<- *eventmodels.DBEvent) AgentOption {
	return func(a *Agent) {
		a.cfg.EventStreamingConfig.E2eDBEventChan = ch
	}
}

func NewAgent(ctx context.Context, db *pgxpool.Pool, opts ...AgentOption) (*Agent, error) {
	cfg := config.ConfigFromContext(ctx)
	logger := logger.Logger()

	a := &Agent{
		db:              db,
		cfg:             cfg,
		logger:          logger,
		schemaPbPkgName: proto.String("db"),
		strictSchema:    true,
	}

	for _, opt := range opts {
		opt(a)
	}

	initializedDestinations, initializedDBDestinations, err := a.cfg.EventStreamingConfig.GetInitializedDestinations(logger)
	if err != nil {
		return nil, err
	}
	a.processedEventDestinations = initializedDestinations
	a.dbEventDestinations = initializedDBDestinations
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
			tx.Rollback(ctx)
		}
		return false, nil
	}

	a.logger.Info("fetched events for processing", "count", len(dbEvents))

	// Track events to send to API and events to flush from DB
	eventIds := make([]int64, len(dbEvents))
	eventRetriesMap := make(map[int64]int)
	var processedEvents []*eventmodels.ProcessedEvent
	var failedEventUpdates []*eventmodels.DBEventUpdate

	// Build ID list and retries map for error handling
	for i, dbEvent := range dbEvents {
		eventIds[i] = dbEvent.ID
		eventRetriesMap[dbEvent.ID] = dbEvent.Retries
	}

	// Process events into transformed events
	for _, dbEvent := range dbEvents {
		// Process event with protobuf support
		processedEvent, err := evtxfrm.ProcessEvent(dbEvent, a.cfg.EventStreamingConfig, a.schemaPbPkgName, a.schemaPbDescriptor)
		if err != nil {
			a.logger.Error("failed to process event", "error", err, "event_id", dbEvent.ID)
			// Add to failed events list
			failedEventUpdates = append(failedEventUpdates, GenerateEventErrorUpdate(dbEvent.ID, dbEvent.Retries, err))
			continue
		}

		if processedEvent != nil {
			a.logger.Info("processed event", "event_id", dbEvent.ID, "event_type", dbEvent.EventType, "table", dbEvent.RowTableName)
			// Add to send list
			processedEvents = append(processedEvents, processedEvent)
		} else {
			a.logger.Info("skipping event", "event_id", dbEvent.ID, "event_type", dbEvent.EventType, "table", dbEvent.RowTableName)
		}
	}

	// Only send processed events if there are any to send
	if len(processedEvents) > 0 {
		a.logger.Info("sending processed events to destinations", "count", len(processedEvents))
		eventErrors, err := a.sendProcessedEvents(ctx, processedEvents)
		if err != nil {
			// Handle top-level error for all processed events
			return a.handleBatchError(ctx, tx, eventIds, eventRetriesMap, err)
		} else if len(eventErrors) > 0 {
			// Handle individual event errors
			a.logger.Info("some events failed to send", "error_count", len(eventErrors))
			failedEventUpdates = append(failedEventUpdates, a.generateUpdatesFromErrors(eventErrors, eventRetriesMap)...)
		} else {
			a.logger.Info("successfully sent processed events to destinations", "count", len(processedEvents))
		}
	} else {
		a.logger.Info("no processed events to send to destinations")
	}

	// Send DB events to destinations
	a.logger.Info("sending db events to destinations", "count", len(dbEvents))
	dbEventErrors, err := a.sendDBEvents(ctx, dbEvents)
	if err != nil {
		// Handle top-level error for all db events
		return a.handleBatchError(ctx, tx, eventIds, eventRetriesMap, err)
	} else if len(dbEventErrors) > 0 {
		// Handle individual event errors
		a.logger.Info("some db events failed to send", "error_count", len(dbEventErrors))
		failedEventUpdates = append(failedEventUpdates, a.generateUpdatesFromErrors(dbEventErrors, eventRetriesMap)...)
	} else {
		a.logger.Info("successfully sent db events to destinations", "count", len(dbEvents))
	}

	// Handle failed events and commit successful ones
	return a.finalizeEventBatch(ctx, tx, eventIds, failedEventUpdates)
}

// handleBatchError handles top-level errors that affect all events in a batch
func (a *Agent) handleBatchError(ctx context.Context, tx pgx.Tx, eventIds []int64, eventRetriesMap map[int64]int, err error) (bool, error) {
	a.logger.Error("top-level error sending events to destinations", "error", err)

	// Generate and merge updates for all failed events
	failedUpdates := GenerateEventErrorUpdates(eventIds, eventRetriesMap, err)
	mergedUpdates := MergeEventErrorUpdates(failedUpdates)
	if updateErr := db.UpdateDBEvents(ctx, tx, mergedUpdates); updateErr != nil {
		tx.Rollback(ctx)
		a.logger.Error("failed to update event errors", "error", updateErr)
		return false, updateErr
	}

	if err := tx.Commit(ctx); err != nil {
		a.logger.Error("failed to commit transaction with only failed events", "error", err)
		return false, err
	}
	return false, err
}

// generateUpdatesFromErrors converts destination event errors to DB event updates
func (a *Agent) generateUpdatesFromErrors(eventErrors []*destinations.DestinationEventError, eventRetriesMap map[int64]int) []*eventmodels.DBEventUpdate {
	updates := make([]*eventmodels.DBEventUpdate, 0, len(eventErrors))
	for _, eventError := range eventErrors {
		updates = append(updates,
			GenerateEventErrorUpdate(eventError.EventID, eventRetriesMap[eventError.EventID], eventError.Error))
	}
	return updates
}

// finalizeEventBatch handles failed event updates and flushes successful events
func (a *Agent) finalizeEventBatch(ctx context.Context, tx pgx.Tx, eventIds []int64, failedEventUpdates []*eventmodels.DBEventUpdate) (bool, error) {
	// Update any failed events with error information
	if len(failedEventUpdates) > 0 {
		// Merge updates for the same event ID to handle multiple failures for the same event
		mergedFailedUpdates := MergeEventErrorUpdates(failedEventUpdates)

		a.logger.Info("updating failed events",
			"original_count", len(failedEventUpdates),
			"merged_count", len(mergedFailedUpdates),
			"unique_events", len(mergedFailedUpdates))

		if err := db.UpdateDBEvents(ctx, tx, mergedFailedUpdates); err != nil {
			tx.Rollback(ctx)
			a.logger.Error("failed to update failed events", "error", err)
			return false, err
		}

		// Remove failed event IDs from the list to flush
		failedIDs := make(map[int64]bool)
		for _, update := range mergedFailedUpdates {
			failedIDs[update.ID] = true
		}

		successfulIDs := make([]int64, 0, len(eventIds)-len(failedIDs))
		for _, id := range eventIds {
			if !failedIDs[id] {
				successfulIDs = append(successfulIDs, id)
			}
		}

		eventIds = successfulIDs
	}

	// Flush successful events
	if len(eventIds) > 0 {
		a.logger.Info("flushing successful events", "count", len(eventIds))
		if err := db.FlushDBEvents(ctx, tx, eventIds); err != nil {
			tx.Rollback(ctx)
			a.logger.Error("failed to delete processed events", "error", err)
			return false, err
		}
		if err := tx.Commit(ctx); err != nil {
			a.logger.Error("failed to commit transaction with successful events", "error", err)
			return false, err
		}
		a.logger.Info("flushed successful events", "count", len(eventIds))
	} else if len(failedEventUpdates) > 0 {
		// If we have failed events but no successful ones, commit the transaction to save the updates
		if err := tx.Commit(ctx); err != nil {
			a.logger.Error("failed to commit transaction with only failed events", "error", err)
			return false, err
		}
		a.logger.Info("committed transaction with updates for failed events")
	}

	// Return true if we processed a full batch (indicating there might be more events)
	return len(eventIds) == a.cfg.BatchSize, nil
}

func (a *Agent) sendProcessedEvents(ctx context.Context, events []*eventmodels.ProcessedEvent) ([]*destinations.DestinationEventError, error) {
	var allEventErrors []*destinations.DestinationEventError

	for _, destination := range a.processedEventDestinations {
		filteredEvents := events
		if destination.Filter != "*" {
			filteredEvents = a.filterProcessedEvents(events, destination.Filter)
		}
		if len(filteredEvents) == 0 {
			a.logger.Info("after applying filter, no events to send to destination", "destination", destination.Destination)
			continue
		}
		a.logger.Info("sending events to destination", "destination", destination.Kind, "count", len(filteredEvents))
		eventErrors, err := destination.Destination.SendBatch(ctx, filteredEvents)
		if err != nil {
			a.logger.Error("failed to send events to destination", "error", err)
			return nil, err
		}

		if len(eventErrors) > 0 {
			a.logger.Info("some events failed to send to destination", "destination", destination.Kind, "error_count", len(eventErrors))
			allEventErrors = append(allEventErrors, eventErrors...)
		} else {
			a.logger.Info("successfully sent events to destination", "destination", destination.Kind, "count", len(filteredEvents))
		}
	}

	return allEventErrors, nil
}

func (a *Agent) sendDBEvents(ctx context.Context, events []*eventmodels.DBEvent) ([]*destinations.DestinationEventError, error) {
	var allEventErrors []*destinations.DestinationEventError

	for _, destination := range a.dbEventDestinations {
		filteredEvents := events
		if destination.Filter != "*" {
			filteredEvents = a.filterDBEvents(events, destination.Filter)
		}
		if len(filteredEvents) == 0 {
			a.logger.Info("after applying filter, no events to send to destination", "destination", destination.Destination)
			continue
		}
		a.logger.Info("sending events to destination", "destination", destination.Kind, "count", len(filteredEvents))
		eventErrors, err := destination.Destination.SendBatch(ctx, filteredEvents)
		if err != nil {
			a.logger.Error("failed to send events to destination", "error", err)
			return nil, err
		}

		if len(eventErrors) > 0 {
			a.logger.Info("some events failed to send to destination", "destination", destination.Kind, "error_count", len(eventErrors))
			allEventErrors = append(allEventErrors, eventErrors...)
		} else {
			a.logger.Info("successfully sent events to destination", "destination", destination.Kind, "count", len(filteredEvents))
		}
	}

	return allEventErrors, nil
}

func (a *Agent) filterProcessedEvents(events []*eventmodels.ProcessedEvent, filter string) []*eventmodels.ProcessedEvent {
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

func (a *Agent) filterDBEvents(events []*eventmodels.DBEvent, filter string) []*eventmodels.DBEvent {
	filteredEvents := make([]*eventmodels.DBEvent, 0, len(events))
	for _, event := range events {
		matched, err := filepath.Match(filter, event.RowTableName)
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
