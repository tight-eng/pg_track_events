package destinations

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/posthog/posthog-go"
	"github.com/typeeng/pg_track_events/agent/pkg/eventmodels"
)

// PostHogDestination implements ProcessedEventDestination for sending events to PostHog
type PostHogDestination struct {
	client posthog.Client
	logger *slog.Logger
}

// NewPostHogDestination creates a new PostHog destination with the given API key
func NewPostHogDestination(apiKey string, endpoint string, logger *slog.Logger) (*PostHogDestination, error) {
	if apiKey == "" {
		return nil, fmt.Errorf("API key is required")
	}

	client, err := posthog.NewWithConfig(
		apiKey,
		posthog.Config{
			Endpoint: endpoint,
		},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create PostHog client: %w", err)
	}

	return &PostHogDestination{
		client: client,
		logger: logger,
	}, nil
}

// SendBatch sends a batch of processed events to PostHog
func (p *PostHogDestination) SendBatch(ctx context.Context, processedEvents []*eventmodels.ProcessedEvent) error {
	if len(processedEvents) == 0 {
		return nil
	}

	p.logger.Info("sending events to PostHog", "count", len(processedEvents))

	for _, event := range processedEvents {
		// Create PostHog event
		err := p.client.Enqueue(posthog.Capture{
			DistinctId: event.GetDistinctId(""),
			Event:      event.Name,
			Properties: event.Properties,
			Timestamp:  event.Timestamp,
		})
		if err != nil {
			p.logger.Error("failed to send event to PostHog", "error", err, "event_id", event.DBEventID)
			return fmt.Errorf("failed to send event to PostHog: %w", err)
		}
	}

	p.logger.Info("successfully sent events to PostHog", "count", len(processedEvents))
	return nil
}
