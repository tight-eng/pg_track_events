package destinations

import (
	"context"

	"github.com/typeeng/pg_track_events/agent/pkg/eventmodels"
)

// TestDestination implements ProcessedEventDestination for testing purposes
type TestDestination[T any] struct {
	eventsChan chan<- T
}

// NewTestDestination creates a new test destination that sends events to the provided channel
func NewTestDestination[T any](eventsChan chan<- T) *TestDestination[T] {
	return &TestDestination[T]{
		eventsChan: eventsChan,
	}
}

// SendBatch sends a batch of events to the test channel
func (t *TestDestination[T]) SendBatch(ctx context.Context, events []T) ([]*DestinationEventError, error) {
	if len(events) == 0 {
		return nil, nil
	}

	for _, event := range events {
		select {
		case t.eventsChan <- event:
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}

	return nil, nil
}

// NewTestProcessedEventDestination creates a new test destination for processed events
func NewTestProcessedEventDestination(eventsChan chan<- *eventmodels.ProcessedEvent) *TestDestination[*eventmodels.ProcessedEvent] {
	return NewTestDestination(eventsChan)
}

// NewTestDBEventDestination creates a new test destination for DB events
func NewTestDBEventDestination(eventsChan chan<- *eventmodels.DBEvent) *TestDestination[*eventmodels.DBEvent] {
	return NewTestDestination(eventsChan)
}
