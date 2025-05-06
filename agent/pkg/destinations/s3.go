package destinations

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/typeeng/pg_track_events/agent/pkg/eventmodels"
)

// S3Destination implements ProcessedEventDestination for sending processed events to S3
type S3Destination struct {
	s3Manager *S3Manager
	s3Client  *AWSS3Client
	logger    *slog.Logger
}

// s3ProcessedEvent represents the processed event format for S3
type s3ProcessedEvent struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Properties  map[string]interface{} `json:"properties,omitempty"`
	UserID      string                 `json:"user_id,omitempty"`
	Timestamp   time.Time              `json:"timestamp"`
	ProcessedAt time.Time              `json:"processed_at"`
}

// NewS3Destination creates a new S3 destination for processed events
func NewS3Destination(
	bucket string,
	endpoint string,
	region string,
	rootDir string,
	accessKey string,
	secretKey string,
	logger *slog.Logger,
) (*S3Destination, error) {
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

	return &S3Destination{
		s3Manager: s3Manager,
		s3Client:  s3Client,
		logger:    logger,
	}, nil
}

// SendBatch sends a batch of processed events to S3
func (s *S3Destination) SendBatch(ctx context.Context, processedEvents []*eventmodels.ProcessedEvent) ([]*DestinationEventError, error) {
	if len(processedEvents) == 0 {
		return nil, nil
	}

	s.logger.Info("processing events for S3", "count", len(processedEvents))

	// Group events by event name
	eventNameGroups := make(map[string][]*eventmodels.ProcessedEvent)
	for _, event := range processedEvents {
		eventNameGroups[event.Name] = append(eventNameGroups[event.Name], event)
	}

	// Process each event name group
	for eventName, events := range eventNameGroups {
		buffer := s.s3Manager.GetOrCreateBuffer(eventName, eventName)

		// Convert and write events to buffer
		for _, event := range events {
			s3Event := s3ProcessedEvent{
				ID:          event.DBEventIDStr,
				Name:        event.Name,
				Properties:  event.Properties,
				UserID:      event.GetDistinctId(""),
				Timestamp:   event.Timestamp,
				ProcessedAt: time.Now(),
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
				if err := s.s3Manager.FlushBuffer(ctx, eventName); err != nil {
					return nil, err
				}
			}
		}
	}

	// If flushOnBatch is true, flush all modified buffers
	if s.s3Manager.GetFlushOnBatch() {
		for eventName := range eventNameGroups {
			if err := s.s3Manager.FlushBuffer(ctx, eventName); err != nil {
				return nil, err
			}
		}
	} else {
		// Otherwise only flush buffers that have reached the batch threshold
		for eventName, buffer := range s.s3Manager.buffers {
			if s.s3Manager.ShouldFlushBuffer(buffer) {
				if err := s.s3Manager.FlushBuffer(ctx, eventName); err != nil {
					return nil, err
				}
			}
		}
	}

	return nil, nil
}

// FlushAll flushes all buffers to S3
func (s *S3Destination) FlushAll(ctx context.Context) ([]*DestinationEventError, error) {
	if err := s.s3Manager.FlushAll(ctx); err != nil {
		return nil, err
	}
	return nil, nil
}

// Close flushes all buffers and cleans up resources
func (s *S3Destination) Close(ctx context.Context) ([]*DestinationEventError, error) {
	return s.FlushAll(ctx)
}

// SetFlushOnBatch sets the flushOnBatch flag
func (s *S3Destination) SetFlushOnBatch(flush bool) {
	s.s3Manager.SetFlushOnBatch(flush)
}

// StartPeriodicFlush starts a goroutine that periodically flushes buffers to S3
// Returns a stop function that should be called to stop the periodic flush
func (s *S3Destination) StartPeriodicFlush(flushInterval time.Duration) func() {
	return s.s3Manager.StartPeriodicFlush(flushInterval)
}
