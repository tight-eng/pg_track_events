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
	UserID       *string        `json:"user_id,omitempty"`
}

func (e *ProcessedEvent) GetUserID(fallback string) string {
	if e.UserID == nil {
		return fallback
	}
	return *e.UserID
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
	OldRow       json.RawMessage `json:"old_row,omitempty"`
	NewRow       json.RawMessage `json:"new_row,omitempty"`
}
