package destinations

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/typeeng/pg_track_events/agent/pkg/eventmodels"
)

// AmplitudeDestination implements ProcessedEventDestination for sending events to Amplitude
type AmplitudeDestination struct {
	apiKey   string
	endpoint string
	client   *http.Client
	logger   *slog.Logger
}

// NewAmplitudeDestination creates a new Amplitude destination with the given API key
func NewAmplitudeDestination(apiKey string, endpoint string, logger *slog.Logger) (*AmplitudeDestination, error) {
	if apiKey == "" {
		return nil, fmt.Errorf("API key is required")
	}
	if endpoint == "" {
		endpoint = "https://api2.amplitude.com"
	} else {
		endpoint = strings.TrimSuffix(endpoint, "/")
	}

	return &AmplitudeDestination{
		apiKey:   apiKey,
		endpoint: endpoint,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
		logger: logger,
	}, nil
}

// amplitudeEvent represents the event format expected by Amplitude's API
type amplitudeEvent struct {
	UserID          string                 `json:"user_id"`
	EventType       string                 `json:"event_type"`
	Time            int64                  `json:"time"`
	EventProperties map[string]interface{} `json:"event_properties"`
}

// amplitudeRequest represents the request body format for Amplitude's batch API
type amplitudeRequest struct {
	APIKey string           `json:"api_key"`
	Events []amplitudeEvent `json:"events"`
}

// SendBatch sends a batch of processed events to Amplitude
func (a *AmplitudeDestination) SendBatch(ctx context.Context, processedEvents []*eventmodels.ProcessedEvent) ([]*DestinationEventError, error) {
	if len(processedEvents) == 0 {
		return nil, nil
	}

	a.logger.Info("sending events to Amplitude", "count", len(processedEvents))

	// Convert processed events to Amplitude events
	amplitudeEvents := make([]amplitudeEvent, len(processedEvents))
	for i, event := range processedEvents {
		amplitudeEvents[i] = amplitudeEvent{
			UserID:          event.GetDistinctId(""),
			EventType:       event.Name,
			Time:            event.Timestamp.UnixMilli(),
			EventProperties: event.Properties,
		}
	}

	// Create request body
	requestBody := amplitudeRequest{
		APIKey: a.apiKey,
		Events: amplitudeEvents,
	}

	// Marshal request body
	jsonBody, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal Amplitude request: %w", err)
	}

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, "POST", fmt.Sprintf("%s/batch", a.endpoint), bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create Amplitude request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "*/*")

	// Send request
	resp, err := a.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send events to Amplitude: %w", err)
	}
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("amplitude API returned non-200 status code: %d", resp.StatusCode)
	}

	a.logger.Info("successfully sent events to Amplitude", "count", len(processedEvents))
	return nil, nil
}
