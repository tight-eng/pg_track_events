package config

import (
	"context"
	"strconv"
	"time"

	"github.com/typeeng/tight-agent/internal/env"
)

const (
	databaseURLEnvKey         = "TIGHT_DATABASE_URL"
	analyticsConfigPathEnvKey = "TIGHT_ANALYTICS_CONFIG_PATH"

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
	defaultEventStreamingConfigPath = "tight.analytics.yaml"
)

type AgentConfig struct {
	DatabaseURL          string
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
		BatchSize:            defaultBatchSize,
		FetchInterval:        defaultFetchInterval,
		DefaultSchemaName:    defaultSchemaName,
		InternalSchemaName:   defaultInternalSchemaName,
		EventLogTableName:    defaultEventLogTableName,
		EventStreamingConfig: &EventStreamingConfig{},
	}

	cfg.DatabaseURL = env.FirstOrDefault(cfg.DatabaseURL, databaseURLEnvKey)
	if cfg.DatabaseURL == "" {
		panic("TIGHT_DATABASE_URL is not set")
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

	cfg.EventStreamingConfig, err = ParseEventStreamingConfig(env.FirstOrDefault(defaultEventStreamingConfigPath, analyticsConfigPathEnvKey))
	if err != nil {
		panic(err)
	}

	config = cfg

	return cfg
}
