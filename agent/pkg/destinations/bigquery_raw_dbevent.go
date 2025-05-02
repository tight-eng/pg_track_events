package destinations

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"cloud.google.com/go/bigquery"
	"github.com/typeeng/tight-agent/pkg/eventmodels"
	"google.golang.org/api/option"
)

// BigQueryRawDBEventDestination implements DBEventDestination for sending raw DB events to BigQuery
type BigQueryRawDBEventDestination struct {
	client    *bigquery.Client
	projectID string
	datasetID string
	tableID   string
	logger    *slog.Logger
}

// NewBigQueryRawDBEventDestination creates a new BigQuery destination for raw DB events
func NewBigQueryRawDBEventDestination(credentialsJSON string, tableID string, logger *slog.Logger) (*BigQueryRawDBEventDestination, error) {
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

	return &BigQueryRawDBEventDestination{
		client:    client,
		projectID: projectID,
		datasetID: datasetID,
		tableID:   tableName,
		logger:    logger,
	}, nil
}

// bigqueryRawDBEvent represents the raw DB event format for BigQuery
type bigqueryRawDBEvent struct {
	ID           string    `bigquery:"id"`
	EventType    string    `bigquery:"event_type"`
	RowTableName string    `bigquery:"row_table_name"`
	OldRow       string    `bigquery:"old_row"`
	NewRow       string    `bigquery:"new_row"`
	LoggedAt     time.Time `bigquery:"logged_at"`
}

// SendBatch sends a batch of DB events to BigQuery
func (b *BigQueryRawDBEventDestination) SendBatch(ctx context.Context, dbEvents []*eventmodels.DBEvent) error {
	if len(dbEvents) == 0 {
		return nil
	}

	b.logger.Info("sending raw DB events to BigQuery", "count", len(dbEvents))

	// Convert DB events to BigQuery events
	bigqueryRawEvents := make([]*bigqueryRawDBEvent, len(dbEvents))
	for i, event := range dbEvents {
		var oldRowJSON, newRowJSON string

		// Marshal old row data to JSON if available
		if event.OldRow != nil {
			oldRowJSON = string(event.OldRow)
		}

		// Marshal new row data to JSON if available
		if event.NewRow != nil {
			newRowJSON = string(event.NewRow)
		}

		bigqueryRawEvents[i] = &bigqueryRawDBEvent{
			ID:           fmt.Sprintf("%d", event.ID),
			EventType:    string(event.EventType),
			RowTableName: event.RowTableName,
			OldRow:       oldRowJSON,
			NewRow:       newRowJSON,
			LoggedAt:     event.LoggedAt,
		}
	}

	// Get the table reference
	table := b.client.Dataset(b.datasetID).Table(b.tableID)

	// Create an inserter
	inserter := table.Inserter()

	// Insert the events
	if err := inserter.Put(ctx, bigqueryRawEvents); err != nil {
		b.logger.Error("failed to insert raw DB events to BigQuery", "error", err)
		return fmt.Errorf("failed to insert raw DB events to BigQuery: %w", err)
	}

	b.logger.Info("successfully sent raw DB events to BigQuery", "count", len(dbEvents))
	return nil
}
