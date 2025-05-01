package destinations

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/mixpanel/mixpanel-go"
	"github.com/typeeng/tight-agent/pkg/eventmodels"
)

// MixpanelDestination implements ProcessedEventDestination for sending events to Mixpanel
type MixpanelDestination struct {
	client *mixpanel.ApiClient
	logger *slog.Logger
}

// NewMixpanelDestination creates a new Mixpanel destination with the given project token
func NewMixpanelDestination(projectToken string, logger *slog.Logger) (*MixpanelDestination, error) {
	if projectToken == "" {
		return nil, fmt.Errorf("project token is required")
	}

	client := mixpanel.NewApiClient(projectToken)
	if client == nil {
		return nil, fmt.Errorf("failed to create Mixpanel client")
	}

	return &MixpanelDestination{
		client: client,
		logger: logger,
	}, nil
}

// SendBatch sends a batch of processed events to Mixpanel
func (m *MixpanelDestination) SendBatch(ctx context.Context, processedEvents []*eventmodels.ProcessedEvent) error {
	if len(processedEvents) == 0 {
		return nil
	}

	// Convert processed events to Mixpanel events
	mixpanelEvents := make([]*mixpanel.Event, len(processedEvents))
	for i, event := range processedEvents {
		// Create Mixpanel event
		mixpanelEvents[i] = m.client.NewEvent(
			event.Name,
			event.GetDistinctId(""),
			event.Properties,
		)
		// Best timestamp
		mixpanelEvents[i].AddTime(event.Timestamp)
		// Deduplication
		mixpanelEvents[i].AddInsertID(event.DBEventIDStr)
		// Ensure that server IPs dont get sent to Mixpanel
		mixpanelEvents[i].Properties["ip"] = "0"
	}

	m.logger.Info("sending events to Mixpanel", "count", len(mixpanelEvents))

	// Send events to Mixpanel
	importStatus, err := m.client.Import(ctx, mixpanelEvents, mixpanel.ImportOptions{
		Strict:      false,
		Compression: mixpanel.Gzip,
	})
	if err != nil {
		m.logger.Error("failed to send events to Mixpanel", "error", err)
		return fmt.Errorf("failed to send events to Mixpanel: %w", err)
	}
	m.logger.Info("mixpanel import status", "status", importStatus)

	m.logger.Info("successfully sent events to Mixpanel", "count", len(mixpanelEvents))
	return nil
}
