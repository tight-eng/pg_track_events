package evtxfrm

import (
	"encoding/json"
	"fmt"

	"github.com/google/cel-go/cel"
	"github.com/typeeng/tight-agent/internal/config"
	"github.com/typeeng/tight-agent/internal/db"
)

type ProcessedEvent struct {
	Name       string
	Properties map[string]interface{}
}

func ProcessEvent(dbEvent *db.DBEvent, cfg *config.EventStreamingConfig) (*ProcessedEvent, error) {
	// Create the key for looking up tracking config
	key := fmt.Sprintf("%s.%s", dbEvent.RowTableName, dbEvent.EventType)
	trackingConfig, exists := cfg.Track[key]
	if !exists {
		return nil, nil // No tracking config for this event
	}

	// Parse JSON data
	var newData, oldData, tableNameData map[string]interface{}
	if len(dbEvent.NewRow) > 0 {
		if err := json.Unmarshal(dbEvent.NewRow, &newData); err != nil {
			return nil, fmt.Errorf("failed to parse new row data: %w", err)
		}
	}
	if len(dbEvent.OldRow) > 0 {
		if err := json.Unmarshal(dbEvent.OldRow, &oldData); err != nil {
			return nil, fmt.Errorf("failed to parse old row data: %w", err)
		}
	}

	if dbEvent.EventType == "insert" || dbEvent.EventType == "update" {
		tableNameData = newData
	} else if dbEvent.EventType == "delete" {
		tableNameData = oldData
	}

	// Create input map for CEL evaluation
	input := map[string]interface{}{
		dbEvent.RowTableName: tableNameData,
		"new":                newData,
		"old":                oldData,
	}

	switch ec := trackingConfig.EventConfig.(type) {
	case *config.SimpleEvent:
		// For simple events, just evaluate the properties
		properties, err := evaluateProperties(ec.CompiledProperties, input)
		if err != nil {
			return nil, fmt.Errorf("failed to evaluate properties: %w", err)
		}

		return &ProcessedEvent{
			Name:       ec.Event,
			Properties: properties,
		}, nil

	case *config.ConditionalEvent:
		// First evaluate the condition
		condResult, err := evaluateCondition(ec.CompiledCond, input)
		if err != nil {
			return nil, fmt.Errorf("failed to evaluate condition: %w", err)
		}

		if !condResult {
			return nil, nil // Condition not met, skip this event
		}

		// Find the matching event based on the condition
		for eventName, event := range ec.Events {
			properties, err := evaluateProperties(event.CompiledProperties, input)
			if err != nil {
				return nil, fmt.Errorf("failed to evaluate properties for event %s: %w", eventName, err)
			}

			return &ProcessedEvent{
				Name:       eventName,
				Properties: properties,
			}, nil
		}

		return nil, nil // No matching event found
	}

	return nil, nil
}

func evaluateCondition(prg cel.Program, input map[string]interface{}) (bool, error) {
	out, _, err := prg.Eval(input)
	if err != nil {
		return false, fmt.Errorf("failed to evaluate condition: %w", err)
	}

	result, ok := out.Value().(bool)
	if !ok {
		return false, fmt.Errorf("condition did not return a boolean value")
	}

	return result, nil
}

func evaluateProperties(compiledProps map[string]cel.Program, input map[string]interface{}) (map[string]interface{}, error) {
	properties := make(map[string]interface{})
	for key, prg := range compiledProps {
		out, _, err := prg.Eval(input)
		if err != nil {
			return nil, fmt.Errorf("failed to evaluate property %s: %w", key, err)
		}
		properties[key] = out.Value()
	}
	return properties, nil
}
