package destinations

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"cloud.google.com/go/bigquery"
	"github.com/typeeng/pg_track_events/agent/pkg/eventmodels"
	"google.golang.org/api/option"
)

// BigQueryDestination implements ProcessedEventDestination for sending events to BigQuery
type BigQueryDestination struct {
	client    *bigquery.Client
	projectID string
	datasetID string
	tableID   string
	logger    *slog.Logger
}

// NewBigQueryDestination creates a new BigQuery destination with the given credentials
func NewBigQueryDestination(credentialsJSON string, tableID string, logger *slog.Logger) (*BigQueryDestination, error) {
	if credentialsJSON == "" {
		return nil, fmt.Errorf("credentials JSON is required")
	}
	if tableID == "" {
		return nil, fmt.Errorf("table ID is required")
	}

	// Parse table ID to extract project ID and dataset ID
	parts := strings.Split(tableID, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("table ID must be in format project_id.dataset_id.table_name")
	}
	projectID := parts[0]
	datasetID := parts[1]
	tableName := parts[2]

	ctx := context.Background()
	client, err := bigquery.NewClient(ctx, projectID, option.WithCredentialsJSON([]byte(credentialsJSON)))
	if err != nil {
		return nil, fmt.Errorf("failed to create BigQuery client: %w", err)
	}

	return &BigQueryDestination{
		client:    client,
		projectID: projectID,
		datasetID: datasetID,
		tableID:   tableName,
		logger:    logger,
	}, nil
}

// bigqueryEvent represents the event format for BigQuery
type bigqueryEvent struct {
	ID          string    `bigquery:"id"`
	Name        string    `bigquery:"name"`
	Properties  string    `bigquery:"properties"`
	UserID      string    `bigquery:"user_id"`
	Timestamp   time.Time `bigquery:"timestamp"`
	ProcessedAt time.Time `bigquery:"processed_at"`
}

// SendBatch sends a batch of processed events to BigQuery
func (b *BigQueryDestination) SendBatch(ctx context.Context, processedEvents []*eventmodels.ProcessedEvent) ([]*DestinationEventError, error) {
	if len(processedEvents) == 0 {
		return nil, nil
	}

	b.logger.Info("sending events to BigQuery", "count", len(processedEvents))

	// Convert processed events to BigQuery events
	bigqueryEvents := make([]*bigqueryEvent, len(processedEvents))
	for i, event := range processedEvents {
		evtPropsJson, err := json.Marshal(event.Properties)
		if err != nil {
			b.logger.Error("failed to marshal properties", "error", err, "event", event)
			return nil, fmt.Errorf("failed to marshal properties: %w", err)
		}
		bigqueryEvents[i] = &bigqueryEvent{
			ID:          event.DBEventIDStr,
			Name:        event.Name,
			Properties:  string(evtPropsJson),
			UserID:      event.GetDistinctId(""),
			Timestamp:   event.Timestamp,
			ProcessedAt: time.Now(),
		}
		fmt.Println("bigqueryEvents", bigqueryEvents[i])
	}

	// Get the table reference
	table := b.client.Dataset(b.datasetID).Table(b.tableID)

	// Create an inserter
	inserter := table.Inserter()

	// Insert the events
	if err := inserter.Put(ctx, bigqueryEvents); err != nil {
		b.logger.Error("failed to insert events to BigQuery", "error", err)
		return nil, fmt.Errorf("failed to insert events to BigQuery: %w", err)
	}

	b.logger.Info("successfully sent events to BigQuery", "count", len(processedEvents))
	return nil, nil
}
