package destinations

import (
	"bufio"
	"bytes"
	"context"
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
)

// S3Constants provides constants for S3 operations
type S3Constants struct {
	MaxEventsPerFile    int
	DefaultPartSize     int
	DefaultBatchSize    int
	FileTimestampFormat string
	MaxUploadRetries    int
	RetryBackoffBase    time.Duration
}

// DefaultS3Constants returns the default S3 constants
func DefaultS3Constants() S3Constants {
	return S3Constants{
		MaxEventsPerFile:    20000,
		DefaultPartSize:     5 * 1024 * 1024,
		DefaultBatchSize:    1000,
		FileTimestampFormat: "20060102T150405Z",
		MaxUploadRetries:    3,
		RetryBackoffBase:    200 * time.Millisecond,
	}
}

// S3Buffer represents a buffer that writes to a specific S3 path
type S3Buffer struct {
	Key           string
	S3Key         string
	Buffer        *bytes.Buffer
	Writer        *bufio.Writer
	EventsCount   int
	StartTime     time.Time
	LastWriteTime time.Time
}

// S3Client provides an interface for S3 operations
type S3Client interface {
	UploadToS3(ctx context.Context, s3Key string, content []byte) error
	CheckS3Connection(ctx context.Context) error
}

// AWSS3Client implements S3Client using AWS SDK
type AWSS3Client struct {
	client *s3.Client
	bucket string
	logger *slog.Logger
	consts S3Constants
}

// NewAWSS3Client creates a new AWS S3 client
func NewAWSS3Client(
	bucket string,
	endpoint string,
	region string,
	accessKey string,
	secretKey string,
	logger *slog.Logger,
) (*AWSS3Client, error) {
	if bucket == "" {
		return nil, fmt.Errorf("bucket is required")
	}

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

	awsClient := &AWSS3Client{
		client: client,
		bucket: bucket,
		logger: logger,
		consts: DefaultS3Constants(),
	}

	// Verify S3 connection and bucket access
	if err := awsClient.CheckS3Connection(context.Background()); err != nil {
		return nil, fmt.Errorf("S3 connection check failed: %w", err)
	}

	return awsClient, nil
}

// CheckS3Connection verifies that we can connect to S3 and access the bucket
func (c *AWSS3Client) CheckS3Connection(ctx context.Context) error {
	_, err := c.client.HeadBucket(ctx, &s3.HeadBucketInput{
		Bucket: aws.String(c.bucket),
	})
	return err
}

// UploadToS3 uploads data to S3 with retries
func (c *AWSS3Client) UploadToS3(ctx context.Context, s3Key string, content []byte) error {
	var lastErr error
	eventCount := bytes.Count(content, []byte("\n"))

	for attempt := 0; attempt < c.consts.MaxUploadRetries; attempt++ {
		if attempt > 0 {
			// Exponential backoff with jitter
			backoff := c.consts.RetryBackoffBase * time.Duration(1<<attempt)
			jitter := time.Duration(rand.Int63n(int64(backoff / 4)))
			sleepTime := backoff + jitter

			select {
			case <-time.After(sleepTime):
				// Continue with retry
			case <-ctx.Done():
				return fmt.Errorf("context cancelled during retry: %w", ctx.Err())
			}

			c.logger.Info("retrying S3 upload",
				"attempt", attempt+1,
				"key", s3Key,
				"previous_error", lastErr)
		}

		// Upload to S3
		c.logger.Info("uploading events to S3",
			"bucket", c.bucket,
			"key", s3Key,
			"eventCount", eventCount,
			"contentSize", len(content),
			"attempt", attempt+1)

		// Create a context with timeout for this attempt
		uploadCtx, cancel := context.WithTimeout(ctx, 30*time.Second)

		_, err := c.client.PutObject(uploadCtx, &s3.PutObjectInput{
			Bucket:      aws.String(c.bucket),
			Key:         aws.String(s3Key),
			Body:        bytes.NewReader(content),
			ContentType: aws.String("application/x-ndjson"),
		})

		cancel() // Always cancel the context to prevent leaks

		if err == nil {
			c.logger.Info("successfully uploaded events to S3",
				"bucket", c.bucket,
				"key", s3Key,
				"eventCount", eventCount)
			return nil
		}

		lastErr = err
		c.logger.Error("failed to upload to S3",
			"attempt", attempt+1,
			"bucket", c.bucket,
			"key", s3Key,
			"error", err)
	}

	return fmt.Errorf("failed to upload to S3 after %d attempts: %w", c.consts.MaxUploadRetries, lastErr)
}

// S3Manager manages buffers and uploads to S3
type S3Manager struct {
	client       S3Client
	rootDir      string
	agentID      string
	logger       *slog.Logger
	buffers      map[string]*S3Buffer
	buffersMutex sync.Mutex
	flushOnBatch bool
	consts       S3Constants
}

// NewS3Manager creates a new S3 manager
func NewS3Manager(
	client S3Client,
	rootDir string,
	logger *slog.Logger,
) *S3Manager {
	if rootDir == "" {
		rootDir = "./"
	}

	// Generate a unique agent ID
	agentID := uuid.New().String()

	return &S3Manager{
		client:       client,
		rootDir:      rootDir,
		agentID:      agentID,
		logger:       logger,
		buffers:      make(map[string]*S3Buffer),
		flushOnBatch: true, // Default to true for persistence guarantee
		consts:       DefaultS3Constants(),
	}
}

// GetOrCreateBuffer returns an existing buffer for the given key or creates a new one
func (m *S3Manager) GetOrCreateBuffer(key string, dirPath string) *S3Buffer {
	m.buffersMutex.Lock()
	defer m.buffersMutex.Unlock()

	buffer, exists := m.buffers[key]
	if exists && buffer.EventsCount < m.consts.MaxEventsPerFile {
		return buffer
	}

	// Create a new buffer
	now := time.Now().UTC()
	s3Key := path.Join(m.rootDir, dirPath, fmt.Sprintf("%s-%s.jsonl", now.Format(m.consts.FileTimestampFormat), m.agentID))

	buf := bytes.NewBuffer(nil)
	writer := bufio.NewWriter(buf)

	newBuffer := &S3Buffer{
		Key:           key,
		S3Key:         s3Key,
		Buffer:        buf,
		Writer:        writer,
		EventsCount:   0,
		StartTime:     now,
		LastWriteTime: now,
	}

	m.buffers[key] = newBuffer
	return newBuffer
}

// FlushBuffer uploads the buffer content to S3 and resets it
func (m *S3Manager) FlushBuffer(ctx context.Context, key string) error {
	m.buffersMutex.Lock()
	buffer, exists := m.buffers[key]
	if !exists || buffer.EventsCount == 0 {
		m.buffersMutex.Unlock()
		return nil
	}

	// Flush writer to buffer
	if err := buffer.Writer.Flush(); err != nil {
		m.buffersMutex.Unlock()
		return fmt.Errorf("failed to flush buffer writer: %w", err)
	}

	// Get buffer content
	content := buffer.Buffer.Bytes()
	s3Key := buffer.S3Key

	// Reset or remove buffer if it's full
	if buffer.EventsCount >= m.consts.MaxEventsPerFile {
		delete(m.buffers, key)
	} else {
		// Keep the buffer but reset its content
		buffer.Buffer.Reset()
		buffer.Writer.Reset(buffer.Buffer)
		buffer.EventsCount = 0
		buffer.LastWriteTime = time.Now().UTC()
	}

	m.buffersMutex.Unlock()

	// Upload to S3
	return m.client.UploadToS3(ctx, s3Key, content)
}

// WriteToBuffer writes data to a buffer
func (m *S3Manager) WriteToBuffer(buffer *S3Buffer, data []byte) error {
	// Write line to buffer
	if _, err := buffer.Writer.Write(data); err != nil {
		return fmt.Errorf("failed to write to buffer: %w", err)
	}
	if _, err := buffer.Writer.Write([]byte("\n")); err != nil {
		return fmt.Errorf("failed to write newline to buffer: %w", err)
	}

	buffer.EventsCount++
	return nil
}

// FlushAll flushes all buffers to S3
func (m *S3Manager) FlushAll(ctx context.Context) error {
	m.buffersMutex.Lock()
	keys := make([]string, 0, len(m.buffers))
	for key := range m.buffers {
		keys = append(keys, key)
	}
	m.buffersMutex.Unlock()

	for _, key := range keys {
		if err := m.FlushBuffer(ctx, key); err != nil {
			return err
		}
	}

	return nil
}

// StartPeriodicFlush starts a goroutine that periodically flushes buffers to S3
// Returns a stop function that should be called to stop the periodic flush
func (m *S3Manager) StartPeriodicFlush(flushInterval time.Duration) func() {
	ctx, cancel := context.WithCancel(context.Background())
	ticker := time.NewTicker(flushInterval)

	go func() {
		for {
			select {
			case <-ticker.C:
				if err := m.FlushAll(ctx); err != nil {
					m.logger.Error("failed to flush S3 buffers", "error", err)
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

// SetFlushOnBatch sets the flushOnBatch flag
func (m *S3Manager) SetFlushOnBatch(flush bool) {
	m.buffersMutex.Lock()
	defer m.buffersMutex.Unlock()
	m.flushOnBatch = flush
}

// GetFlushOnBatch returns the flushOnBatch flag value
func (m *S3Manager) GetFlushOnBatch() bool {
	m.buffersMutex.Lock()
	defer m.buffersMutex.Unlock()
	return m.flushOnBatch
}

// ShouldFlushBuffer determines if a buffer should be flushed based on batch size
func (m *S3Manager) ShouldFlushBuffer(buffer *S3Buffer) bool {
	return buffer.EventsCount >= m.consts.DefaultBatchSize
}
