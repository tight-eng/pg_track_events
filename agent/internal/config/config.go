package config

import (
	"context"
	"strconv"
	"time"

	"github.com/typeeng/tight-agent/internal/env"
)

const (
	apiBaseURLEnvKey               = "TIGHT_API_BASE_URL"
	apiKeyEnvKey                   = "TIGHT_API_KEY"
	databaseURLEnvKey              = "TIGHT_DATABASE_URL"
	eventStreamingConfigPathEnvKey = "TIGHT_EVENT_STREAMING_CONFIG_PATH"
	defaultAPIBaseURL              = "https://api.example.com"

	batchSizeEnvKey      = "TIGHT_BATCH_SIZE"
	fetchIntervalEnvKey  = "TIGHT_FETCH_INTERVAL"
	defaultBatchSize     = 100
	defaultFetchInterval = 5 * time.Second

	defaultSchemaNameEnvKey = "TIGHT_DEFAULT_SCHEMA_NAME"
	defaultSchemaName       = "public"

	internalSchemaNameEnvKey        = "TIGHT_INTERNAL_SCHEMA_NAME"
	eventLogTableNameEnvKey         = "TIGHT_EVENT_LOG_TABLE_NAME"
	defaultInternalSchemaName       = "tight_analytics"
	defaultEventLogTableName        = "event_log"
	defaultEventStreamingConfigPath = "config.yml"
)

type AgentConfig struct {
	APIBaseURL           string
	DatabaseURL          string
	APIKey               string
	BatchSize            int
	FetchInterval        time.Duration
	DefaultSchemaName    string
	InternalSchemaName   string
	EventLogTableName    string
	EventStreamingConfig *EventStreamingConfig
}

var config *AgentConfig

// contextKey is used as a key for storing configuration in context
type contextKey struct{}

var configKey = contextKey{}

// WithConfig returns a new context with the given configuration
func WithConfig(ctx context.Context, cfg *AgentConfig) context.Context {
	return context.WithValue(ctx, configKey, cfg)
}

// ConfigFromContext returns the configuration from the context if it exists,
// otherwise returns the global configuration
func ConfigFromContext(ctx context.Context) *AgentConfig {
	if cfg, ok := ctx.Value(configKey).(*AgentConfig); ok {
		return cfg
	}
	return getDefaultConfig()
}

func getDefaultConfig() *AgentConfig {
	if config != nil {
		return config
	}

	var err error

	cfg := &AgentConfig{
		APIBaseURL:           defaultAPIBaseURL,
		BatchSize:            defaultBatchSize,
		FetchInterval:        defaultFetchInterval,
		DefaultSchemaName:    defaultSchemaName,
		InternalSchemaName:   defaultInternalSchemaName,
		EventLogTableName:    defaultEventLogTableName,
		EventStreamingConfig: &EventStreamingConfig{},
	}

	cfg.APIBaseURL = env.FirstOrDefault(cfg.APIBaseURL, apiBaseURLEnvKey)
	cfg.APIKey = env.First(apiKeyEnvKey)
	if cfg.APIKey == "" {
		panic("TIGHT_API_KEY is not set")
	}

	cfg.DatabaseURL = env.FirstOrDefault(cfg.DatabaseURL, databaseURLEnvKey)
	if cfg.DatabaseURL == "" {
		panic("DATABASE_URL is not set")
	}

	// Parse BatchSize from environment
	if batchSizeStr := env.First(batchSizeEnvKey); batchSizeStr != "" {
		if batchSize, err := strconv.Atoi(batchSizeStr); err == nil && batchSize > 0 {
			cfg.BatchSize = batchSize
		}
	}

	// Parse FetchInterval from environment
	if intervalStr := env.First(fetchIntervalEnvKey); intervalStr != "" {
		if interval, err := time.ParseDuration(intervalStr); err == nil && interval > 0 {
			cfg.FetchInterval = interval
		}
	}

	cfg.DefaultSchemaName = env.FirstOrDefault(cfg.DefaultSchemaName, defaultSchemaNameEnvKey)
	cfg.InternalSchemaName = env.FirstOrDefault(cfg.InternalSchemaName, internalSchemaNameEnvKey)
	cfg.EventLogTableName = env.FirstOrDefault(cfg.EventLogTableName, eventLogTableNameEnvKey)

	cfg.EventStreamingConfig, err = ParseEventStreamingConfig(env.FirstOrDefault(defaultEventStreamingConfigPath, eventStreamingConfigPathEnvKey))
	if err != nil {
		panic(err)
	}

	config = cfg

	return cfg
}
