package destinations

import (
	"context"

	"github.com/typeeng/pg_track_events/agent/pkg/eventmodels"
)

type ProcessedEventDestination interface {
	SendBatch(ctx context.Context, processedEvents []*eventmodels.ProcessedEvent) error
}

type DBEventDestination interface {
	SendBatch(ctx context.Context, dbEvents []*eventmodels.DBEvent) error
}
