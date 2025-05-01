package eventmodels

import (
	"encoding/json"
	"time"
)

type ProcessedEvent struct {
	Name       string
	Properties map[string]interface{}
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
