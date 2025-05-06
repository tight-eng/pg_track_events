package destinations

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/typeeng/pg_track_events/agent/pkg/eventmodels"
)

// S3RawDBEventDestination implements DBEventDestination for sending raw DB events to S3
type S3RawDBEventDestination struct {
	s3Manager *S3Manager
	s3Client  *AWSS3Client
	logger    *slog.Logger
}

// s3RawDBEvent represents the raw DB event format for S3
type s3RawDBEvent struct {
	ID           string          `json:"id"`
	EventType    string          `json:"event_type"`
	RowTableName string          `json:"row_table_name"`
	OldRow       json.RawMessage `json:"old_row,omitempty"`
	NewRow       json.RawMessage `json:"new_row,omitempty"`
	LoggedAt     time.Time       `json:"logged_at"`
}

// NewS3RawDBEventDestination creates a new S3 destination for raw DB events
func NewS3RawDBEventDestination(
	bucket string,
	endpoint string,
	region string,
	rootDir string,
	accessKey string,
	secretKey string,
	logger *slog.Logger,
) (*S3RawDBEventDestination, error) {
	s3Client, err := NewAWSS3Client(
		bucket,
		endpoint,
		region,
		accessKey,
		secretKey,
		logger,
	)
	if err != nil {
		return nil, err
	}

	s3Manager := NewS3Manager(s3Client, rootDir, logger)

	return &S3RawDBEventDestination{
		s3Manager: s3Manager,
		s3Client:  s3Client,
		logger:    logger,
	}, nil
}

// SendBatch sends a batch of DB events to S3
func (s *S3RawDBEventDestination) SendBatch(ctx context.Context, dbEvents []*eventmodels.DBEvent) ([]*DestinationEventError, error) {
	if len(dbEvents) == 0 {
		return nil, nil
	}

	s.logger.Info("processing DB events for S3", "count", len(dbEvents))

	// Group events by table
	tableEvents := make(map[string][]*eventmodels.DBEvent)
	for _, event := range dbEvents {
		tableEvents[event.RowTableName] = append(tableEvents[event.RowTableName], event)
	}

	// Process each table's events
	for tableName, events := range tableEvents {
		buffer := s.s3Manager.GetOrCreateBuffer(tableName, tableName)

		// Convert and write events to buffer
		for _, event := range events {
			s3Event := s3RawDBEvent{
				ID:           fmt.Sprintf("%d", event.ID),
				EventType:    string(event.EventType),
				RowTableName: event.RowTableName,
				LoggedAt:     event.LoggedAt,
			}

			if event.OldRow != nil {
				s3Event.OldRow = event.OldRow
			}

			if event.NewRow != nil {
				s3Event.NewRow = event.NewRow
			}

			// Serialize to JSON
			data, err := json.Marshal(s3Event)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal event to JSON: %w", err)
			}

			// Write to buffer
			if err := s.s3Manager.WriteToBuffer(buffer, data); err != nil {
				return nil, err
			}

			// Flush to S3 if buffer is full
			if buffer.EventsCount >= s.s3Manager.consts.MaxEventsPerFile {
				if err := s.s3Manager.FlushBuffer(ctx, tableName); err != nil {
					return nil, err
				}
			}
		}
	}

	// If flushOnBatch is true, flush all modified buffers
	if s.s3Manager.GetFlushOnBatch() {
		for tableName := range tableEvents {
			if err := s.s3Manager.FlushBuffer(ctx, tableName); err != nil {
				return nil, err
			}
		}
	} else {
		// Otherwise only flush buffers that have reached the batch threshold
		for tableName, buffer := range s.s3Manager.buffers {
			if s.s3Manager.ShouldFlushBuffer(buffer) {
				if err := s.s3Manager.FlushBuffer(ctx, tableName); err != nil {
					return nil, err
				}
			}
		}
	}

	return nil, nil
}

// FlushAll flushes all buffers to S3
func (s *S3RawDBEventDestination) FlushAll(ctx context.Context) ([]*DestinationEventError, error) {
	if err := s.s3Manager.FlushAll(ctx); err != nil {
		return nil, err
	}
	return nil, nil
}

// Close flushes all buffers and cleans up resources
func (s *S3RawDBEventDestination) Close(ctx context.Context) ([]*DestinationEventError, error) {
	return s.FlushAll(ctx)
}

// SetFlushOnBatch sets the flushOnBatch flag
func (s *S3RawDBEventDestination) SetFlushOnBatch(flush bool) {
	s.s3Manager.SetFlushOnBatch(flush)
}

// StartPeriodicFlush starts a goroutine that periodically flushes buffers to S3
// Returns a stop function that should be called to stop the periodic flush
func (s *S3RawDBEventDestination) StartPeriodicFlush(flushInterval time.Duration) func() {
	return s.s3Manager.StartPeriodicFlush(flushInterval)
}
