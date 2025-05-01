package destinations

import "github.com/typeeng/tight-agent/pkg/eventmodels"

type ProcessedEventDestination interface {
	SendBatch(processedEvents []*eventmodels.ProcessedEvent) error
}

type DBEventDestination interface {
	SendBatch(dbEvents []*eventmodels.DBEvent) error
}
