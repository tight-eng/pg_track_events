package evtxfrm

import (
	"encoding/json"
	"fmt"
	"maps"

	"github.com/google/cel-go/cel"
	"github.com/typeeng/tight-agent/internal/config"
	"github.com/typeeng/tight-agent/pkg/celutils"
	"github.com/typeeng/tight-agent/pkg/eventmodels"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/types/dynamicpb"
)

func ProcessEvent(dbEvent *eventmodels.DBEvent, cfg *config.EventStreamingConfig, pbPkgName *string, pbFd protoreflect.FileDescriptor) (*eventmodels.ProcessedEvent, error) {
	// Create the key for looking up tracking config
	key := fmt.Sprintf("%s.%s", dbEvent.RowTableName, dbEvent.EventType)
	trackingConfig, exists := cfg.Track[key]
	if !exists {
		return nil, nil // No tracking config for this event
	}

	// Parse JSON data and convert to protobuf
	var newData, oldData, tableNameData map[string]interface{}
	var newPb, oldPb, tableNamePb proto.Message

	if len(dbEvent.NewRow) > 0 {
		if pbPkgName != nil && pbFd != nil {
			var err error
			newPb, err = marshalToProtobuf(dbEvent.NewRow, dbEvent.RowTableName, pbFd)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal new row to protobuf: %w", err)
			}
		} else {
			if err := json.Unmarshal(dbEvent.NewRow, &newData); err != nil {
				return nil, fmt.Errorf("failed to parse new row data: %w", err)
			}
		}
	}

	if len(dbEvent.OldRow) > 0 {
		if pbPkgName != nil && pbFd != nil {
			var err error
			oldPb, err = marshalToProtobuf(dbEvent.OldRow, dbEvent.RowTableName, pbFd)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal old row to protobuf: %w", err)
			}
		} else {
			if err := json.Unmarshal(dbEvent.OldRow, &oldData); err != nil {
				return nil, fmt.Errorf("failed to parse old row data: %w", err)
			}
		}
	}

	if dbEvent.EventType == "insert" || dbEvent.EventType == "update" {
		tableNameData = newData
		tableNamePb = newPb
	} else if dbEvent.EventType == "delete" {
		tableNameData = oldData
		tableNamePb = oldPb
	}

	// Create input map for CEL evaluation
	input := make(map[string]interface{})
	if pbPkgName != nil && pbFd != nil {
		input[dbEvent.RowTableName] = tableNamePb
		if newPb != nil {
			input["new"] = newPb
		}
		if oldPb != nil {
			input["old"] = oldPb
		}
	} else {
		input[dbEvent.RowTableName] = tableNameData
		if newData != nil {
			input["new"] = newData
		}
		if oldData != nil {
			input["old"] = oldData
		}
	}

	// TODO Implement conditional protobufs
	// TODO Implement properties protobufs
	switch ec := trackingConfig.EventConfig.(type) {
	case *config.SimpleEvent:
		// For simple events, just evaluate the properties
		properties, err := evaluateProperties(ec.CompiledProperties, input)
		if err != nil {
			return nil, fmt.Errorf("failed to evaluate properties: %w", err)
		}

		return &eventmodels.ProcessedEvent{
			Name:       ec.Event,
			Properties: properties,
		}, nil

	case *config.ConditionalEvent:
		// First evaluate the condition
		selectedEventName, err := evaluateCondition(ec.CompiledCond, input, ec.CondEventsPbFd, ec.GetEventNames())
		if err != nil {
			return nil, fmt.Errorf("failed to evaluate condition: %w", err)
		}

		if selectedEventName == nil {
			return nil, nil // No event selected, skip this event
		}

		// Find the matching event based on the condition
		event, exists := ec.Events[*selectedEventName]
		if !exists {
			return nil, fmt.Errorf("selected event %s not found in event configuration", *selectedEventName)
		}

		properties, err := evaluateProperties(event.CompiledProperties, input)
		if err != nil {
			return nil, fmt.Errorf("failed to evaluate properties for conditional event %s: %w", *selectedEventName, err)
		}

		return &eventmodels.ProcessedEvent{
			Name:       *selectedEventName,
			Properties: properties,
		}, nil
	}

	return nil, nil
}

func evaluateCondition(prg cel.Program, input map[string]interface{}, eventPbFd protoreflect.FileDescriptor, eventNames []string) (*string, error) {
	mergedInput := make(map[string]interface{})
	maps.Copy(mergedInput, input)
	eventsPb, err := celutils.NewEventRefPb(eventPbFd, eventNames)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal event names to protobuf: %w", err)
	}
	mergedInput["events"] = eventsPb

	out, _, err := prg.Eval(mergedInput)
	if err != nil {
		return nil, fmt.Errorf("failed to evaluate condition: %w", err)
	}

	if out.Type().TypeName() != celutils.EventRefTypeName() {
		// Get the protobuf message from the CEL result
		msg, ok := out.Value().(proto.Message)
		if !ok {
			return nil, fmt.Errorf("condition did not return a protobuf message")
		}

		// Get the value field from the EventRef message
		msgDesc := msg.ProtoReflect().Descriptor()
		valueField := msgDesc.Fields().ByName("value")
		if valueField == nil {
			return nil, fmt.Errorf("no value field found in EventRef message")
		}

		// Get the selected event name
		selectedEvent := msg.ProtoReflect().Get(valueField).String()
		if selectedEvent == "" {
			return nil, fmt.Errorf("selected event name is empty")
		}
		return &selectedEvent, nil
	} else if out.Type().TypeName() == "null" {
		return nil, nil
	}

	return nil, fmt.Errorf("event condition must return a valid event reference or null, got %v", out.Type().TypeName())
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

// marshalToProtobuf converts a JSON map to a protobuf message
func marshalToProtobuf(data json.RawMessage, tableName string, fd protoreflect.FileDescriptor) (proto.Message, error) {
	// Find the message descriptor for the table
	msgDesc := fd.Messages().ByName(protoreflect.Name(tableName))
	if msgDesc == nil {
		return nil, fmt.Errorf("no message descriptor found for table %s", tableName)
	}

	// Create a new message instance using dynamicpb
	msg := dynamicpb.NewMessage(msgDesc)

	// Unmarshal JSON into the protobuf message
	if err := protojson.Unmarshal(data, msg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal JSON to protobuf: %w", err)
	}

	return msg, nil
}
