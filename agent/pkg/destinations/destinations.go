package destinations

import (
	"context"

	"github.com/typeeng/pg_track_events/agent/pkg/eventmodels"
)

type DestinationEventError struct {
	EventID int64
	Error   error
}

type ProcessedEventDestination interface {
	SendBatch(ctx context.Context, processedEvents []*eventmodels.ProcessedEvent) ([]*DestinationEventError, error)
}

type DBEventDestination interface {
	SendBatch(ctx context.Context, dbEvents []*eventmodels.DBEvent) ([]*DestinationEventError, error)
}
