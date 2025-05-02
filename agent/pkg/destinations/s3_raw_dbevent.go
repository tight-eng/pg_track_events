package destinations

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math/rand"
	"path"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
	"github.com/typeeng/pg_track_events/agent/pkg/eventmodels"
)

const (
	maxEventsPerFile    = 20000                  // Maximum number of events per file
	defaultPartSize     = 5 * 1024 * 1024        // 5MB in bytes
	defaultBatchSize    = 1000                   // Flush after this many events
	fileTimestampFormat = "20060102T150405Z"     // ISO-like format for timestamps in filenames
	maxUploadRetries    = 3                      // Maximum number of retries for uploads
	retryBackoffBase    = 200 * time.Millisecond // Base backoff duration
)

// S3RawDBEventDestination implements DBEventDestination for sending raw DB events to S3
type S3RawDBEventDestination struct {
	client       *s3.Client
	bucket       string
	rootDir      string
	agentID      string
	logger       *slog.Logger
	buffers      map[string]*s3Buffer
	buffersMutex sync.Mutex
}

// s3Buffer represents a buffer for a specific table that writes to a specific S3 path
type s3Buffer struct {
	tableName     string
	s3Key         string
	buffer        *bytes.Buffer
	writer        *bufio.Writer
	eventsCount   int
	startTime     time.Time
	lastWriteTime time.Time
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
	if bucket == "" {
		return nil, fmt.Errorf("bucket is required")
	}
	if rootDir == "" {
		return nil, fmt.Errorf("root directory is required")
	}

	// Generate a unique agent ID if not provided
	agentID := uuid.New().String()

	// Create custom AWS configuration
	customResolver := aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...interface{}) (aws.Endpoint, error) {
		if endpoint != "" {
			return aws.Endpoint{
				URL:           endpoint,
				SigningRegion: region,
			}, nil
		}
		// Use default endpoint resolution
		return aws.Endpoint{}, &aws.EndpointNotFoundError{}
	})

	// Configure AWS SDK
	cfg, err := config.LoadDefaultConfig(context.Background(),
		config.WithRegion(region),
		config.WithEndpointResolverWithOptions(customResolver),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(accessKey, secretKey, "")),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS configuration: %w", err)
	}

	// Create S3 client
	client := s3.NewFromConfig(cfg)

	s3Dest := &S3RawDBEventDestination{
		client:  client,
		bucket:  bucket,
		rootDir: rootDir,
		agentID: agentID,
		logger:  logger,
		buffers: make(map[string]*s3Buffer),
	}

	// Verify S3 connection and bucket access
	if err := s3Dest.checkS3Connection(context.Background()); err != nil {
		return nil, fmt.Errorf("S3 connection check failed: %w", err)
	}

	return s3Dest, nil
}

// checkS3Connection verifies that we can connect to S3 and access the bucket
func (s *S3RawDBEventDestination) checkS3Connection(ctx context.Context) error {
	_, err := s.client.HeadBucket(ctx, &s3.HeadBucketInput{
		Bucket: aws.String(s.bucket),
	})
	return err
}

// getOrCreateBuffer returns an existing buffer for the given table or creates a new one
func (s *S3RawDBEventDestination) getOrCreateBuffer(tableName string) *s3Buffer {
	s.buffersMutex.Lock()
	defer s.buffersMutex.Unlock()

	buffer, exists := s.buffers[tableName]
	if exists && buffer.eventsCount < maxEventsPerFile {
		return buffer
	}

	// Create a new buffer
	now := time.Now().UTC()
	s3Key := path.Join(s.rootDir, tableName, fmt.Sprintf("%s-%s.jsonl", now.Format(fileTimestampFormat), s.agentID))

	buf := bytes.NewBuffer(nil)
	writer := bufio.NewWriter(buf)

	newBuffer := &s3Buffer{
		tableName:     tableName,
		s3Key:         s3Key,
		buffer:        buf,
		writer:        writer,
		eventsCount:   0,
		startTime:     now,
		lastWriteTime: now,
	}

	s.buffers[tableName] = newBuffer
	return newBuffer
}

// flushBuffer uploads the buffer content to S3 and resets it
func (s *S3RawDBEventDestination) flushBuffer(ctx context.Context, tableName string) error {
	s.buffersMutex.Lock()
	buffer, exists := s.buffers[tableName]
	if !exists || buffer.eventsCount == 0 {
		s.buffersMutex.Unlock()
		return nil
	}

	// Flush writer to buffer
	if err := buffer.writer.Flush(); err != nil {
		s.buffersMutex.Unlock()
		return fmt.Errorf("failed to flush buffer writer: %w", err)
	}

	// Get buffer content
	content := buffer.buffer.Bytes()
	s3Key := buffer.s3Key
	eventCount := buffer.eventsCount

	// Reset or remove buffer if it's full
	if buffer.eventsCount >= maxEventsPerFile {
		delete(s.buffers, tableName)
	} else {
		// Keep the buffer but reset its content
		buffer.buffer.Reset()
		buffer.writer.Reset(buffer.buffer)
		buffer.eventsCount = 0
		buffer.lastWriteTime = time.Now().UTC()
	}

	s.buffersMutex.Unlock()

	// Upload to S3 with retries
	return s.uploadWithRetries(ctx, s3Key, content, eventCount)
}

// uploadWithRetries uploads data to S3 with exponential backoff retries
func (s *S3RawDBEventDestination) uploadWithRetries(ctx context.Context, s3Key string, content []byte, eventCount int) error {
	var lastErr error

	for attempt := 0; attempt < maxUploadRetries; attempt++ {
		if attempt > 0 {
			// Exponential backoff with jitter
			backoff := retryBackoffBase * time.Duration(1<<attempt)
			jitter := time.Duration(rand.Int63n(int64(backoff / 4)))
			sleepTime := backoff + jitter

			select {
			case <-time.After(sleepTime):
				// Continue with retry
			case <-ctx.Done():
				return fmt.Errorf("context cancelled during retry: %w", ctx.Err())
			}

			s.logger.Info("retrying S3 upload",
				"attempt", attempt+1,
				"key", s3Key,
				"previous_error", lastErr)
		}

		// Upload to S3
		s.logger.Info("uploading events to S3",
			"bucket", s.bucket,
			"key", s3Key,
			"eventCount", eventCount,
			"contentSize", len(content),
			"attempt", attempt+1)

		// Create a context with timeout for this attempt
		uploadCtx, cancel := context.WithTimeout(ctx, 30*time.Second)

		_, err := s.client.PutObject(uploadCtx, &s3.PutObjectInput{
			Bucket:      aws.String(s.bucket),
			Key:         aws.String(s3Key),
			Body:        bytes.NewReader(content),
			ContentType: aws.String("application/x-ndjson"),
		})

		cancel() // Always cancel the context to prevent leaks

		if err == nil {
			s.logger.Info("successfully uploaded events to S3",
				"bucket", s.bucket,
				"key", s3Key,
				"eventCount", eventCount)
			return nil
		}

		lastErr = err
		s.logger.Error("failed to upload to S3",
			"attempt", attempt+1,
			"bucket", s.bucket,
			"key", s3Key,
			"error", err)
	}

	return fmt.Errorf("failed to upload to S3 after %d attempts: %w", maxUploadRetries, lastErr)
}

// SendBatch sends a batch of DB events to S3
func (s *S3RawDBEventDestination) SendBatch(ctx context.Context, dbEvents []*eventmodels.DBEvent) error {
	if len(dbEvents) == 0 {
		return nil
	}

	s.logger.Info("processing DB events for S3", "count", len(dbEvents))

	// Group events by table
	tableEvents := make(map[string][]*eventmodels.DBEvent)
	for _, event := range dbEvents {
		tableEvents[event.RowTableName] = append(tableEvents[event.RowTableName], event)
	}

	// Process each table's events
	for tableName, events := range tableEvents {
		buffer := s.getOrCreateBuffer(tableName)

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

			// Serialize to JSON and write to buffer
			data, err := json.Marshal(s3Event)
			if err != nil {
				return fmt.Errorf("failed to marshal event to JSON: %w", err)
			}

			// Write line to buffer
			if _, err := buffer.writer.Write(data); err != nil {
				return fmt.Errorf("failed to write to buffer: %w", err)
			}
			if _, err := buffer.writer.Write([]byte("\n")); err != nil {
				return fmt.Errorf("failed to write newline to buffer: %w", err)
			}

			buffer.eventsCount++

			// Flush to S3 if buffer is full
			if buffer.eventsCount >= maxEventsPerFile {
				if err := s.flushBuffer(ctx, tableName); err != nil {
					return err
				}
			}
		}
	}

	// We'll only automatically flush if we have a reasonable amount of events
	// Otherwise, we'll wait for more events to accumulate or for an explicit FlushAll call
	for tableName, buffer := range s.buffers {
		if buffer.eventsCount >= defaultBatchSize {
			if err := s.flushBuffer(ctx, tableName); err != nil {
				return err
			}
		}
	}

	return nil
}

// FlushAll flushes all buffers to S3
func (s *S3RawDBEventDestination) FlushAll(ctx context.Context) error {
	s.buffersMutex.Lock()
	tableNames := make([]string, 0, len(s.buffers))
	for tableName := range s.buffers {
		tableNames = append(tableNames, tableName)
	}
	s.buffersMutex.Unlock()

	for _, tableName := range tableNames {
		if err := s.flushBuffer(ctx, tableName); err != nil {
			return err
		}
	}

	return nil
}

// Close flushes all buffers and cleans up resources
func (s *S3RawDBEventDestination) Close(ctx context.Context) error {
	return s.FlushAll(ctx)
}

// StartPeriodicFlush starts a goroutine that periodically flushes buffers to S3
// Returns a stop function that should be called to stop the periodic flush
func (s *S3RawDBEventDestination) StartPeriodicFlush(flushInterval time.Duration) func() {
	ctx, cancel := context.WithCancel(context.Background())
	ticker := time.NewTicker(flushInterval)

	go func() {
		for {
			select {
			case <-ticker.C:
				if err := s.FlushAll(ctx); err != nil {
					s.logger.Error("failed to flush S3 buffers", "error", err)
				}
			case <-ctx.Done():
				ticker.Stop()
				return
			}
		}
	}()

	return func() {
		cancel()
	}
}
