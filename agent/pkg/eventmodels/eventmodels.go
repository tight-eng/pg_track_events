package eventmodels

import (
	"encoding/json"
	"time"
)

type ProcessedEvent struct {
	DBEventID    int64          `json:"id"`
	DBEventIDStr string         `json:"id_str"`
	Name         string         `json:"name"`
	Properties   map[string]any `json:"properties"`
	Timestamp    time.Time      `json:"ts"`
	DistinctId   *string        `json:"distinct_id,omitempty"`
}

func (e *ProcessedEvent) GetDistinctId(fallback string) string {
	if e.DistinctId == nil {
		return fallback
	}
	return *e.DistinctId
}

type DBEventType string

const (
	EventTypeInsert DBEventType = "insert"
	EventTypeUpdate DBEventType = "update"
	EventTypeDelete DBEventType = "delete"
)

type DBEvent struct {
	ID           int64           `json:"id"`
	EventType    DBEventType     `json:"event_type"`
	RowTableName string          `json:"row_table_name"`
	LoggedAt     time.Time       `json:"logged_at"`
	Retries      int             `json:"retries"`
	LastError    *string         `json:"last_error,omitempty"`
	LastRetryAt  *time.Time      `json:"last_retry_at,omitempty"`
	ProcessAfter *time.Time      `json:"process_after,omitempty"`
	OldRow       json.RawMessage `json:"old_row,omitempty"`
	NewRow       json.RawMessage `json:"new_row,omitempty"`
	Metadata     json.RawMessage `json:"metadata,omitempty"`
}

type DBEventUpdate struct {
	ID           int64
	Retries      int
	LastError    *string
	LastRetryAt  *time.Time
	ProcessAfter *time.Time
}
