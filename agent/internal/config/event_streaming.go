package config

import (
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/google/cel-go/cel"
	"github.com/typeeng/tight-agent/pkg/celutils"
	"github.com/typeeng/tight-agent/pkg/destinations"
	"google.golang.org/protobuf/reflect/protoreflect"
	"gopkg.in/yaml.v3"
)

// SimpleEvent represents a basic analytics event configuration
type SimpleEvent struct {
	Event      string            `yaml:"event"`
	Properties map[string]string `yaml:"properties,omitempty"`
	// Compiled CEL expressions for properties
	CompiledProperties map[string]cel.Program
}

// ConditionalEvent represents an event with conditions
type ConditionalEvent struct {
	Cond string `yaml:"cond"`
	// Compiled CEL expression for the condition
	CompiledCond   cel.Program
	CondEventsPbFd protoreflect.FileDescriptor
	Events         map[string]struct {
		Properties map[string]string `yaml:"properties,omitempty"`
		// Compiled CEL expressions for properties
		CompiledProperties map[string]cel.Program
	} `yaml:",inline"`
}

func (ce *ConditionalEvent) GetEventNames() []string {
	events := make([]string, 0, len(ce.Events))
	for eventName := range ce.Events {
		events = append(events, eventName)
	}
	return events
}

// EventConfig is an interface that both SimpleEvent and ConditionalEvent implement
type EventConfig interface {
	isEventConfig()
}

// Implement the EventConfig interface
func (*SimpleEvent) isEventConfig()      {}
func (*ConditionalEvent) isEventConfig() {}

// Custom unmarshaler for EventConfig to handle the union type
type EventConfigUnmarshaler struct {
	EventConfig
}

func (ec *EventConfigUnmarshaler) UnmarshalYAML(value *yaml.Node) error {
	// Try to unmarshal as SimpleEvent first
	simpleEvent := &SimpleEvent{}
	if err := value.Decode(simpleEvent); err == nil && simpleEvent.Event != "" {
		ec.EventConfig = simpleEvent
		return nil
	}

	// Try to unmarshal as ConditionalEvent
	conditionalEvent := &ConditionalEvent{}
	if err := value.Decode(conditionalEvent); err == nil && conditionalEvent.Cond != "" {
		ec.EventConfig = conditionalEvent
		return nil
	}

	return fmt.Errorf("invalid event config format")
}

// TrackingConfig maps table operations to event configurations
type TrackingConfig map[string]EventConfigUnmarshaler

// DestinationConfig represents the configuration for a single analytics destination
type DestinationConfig struct {
	APIKey string `yaml:"apiKey"`
	Filter string `yaml:"filter,omitempty"`
}

type InitializedProcessedEventDestination struct {
	Kind        string
	Filter      string
	Destination destinations.ProcessedEventDestination
}

// Validate checks if the APIKey is in the correct format
func (dc *DestinationConfig) Validate() error {
	if strings.HasPrefix(dc.APIKey, "$") {
		envVarName := strings.TrimPrefix(dc.APIKey, "$")
		val, ok := os.LookupEnv(envVarName)
		if !ok {
			return fmt.Errorf("destination API key environment variable %s is not set", envVarName)
		}
		dc.APIKey = val
	}

	if dc.Filter == "" {
		dc.Filter = "*"
	}
	dc.Filter = strings.TrimSpace(dc.Filter)
	if dc.Filter != "*" {
		if _, err := filepath.Match(dc.Filter, ""); err != nil {
			return fmt.Errorf("invalid filter pattern: %w", err)
		}
	}
	return nil
}

// EventStreamingConfig is the root configuration structure
type EventStreamingConfig struct {
	Track        TrackingConfig               `yaml:"track"`
	Destinations map[string]DestinationConfig `yaml:"destinations,omitempty"`
}

// compileProperties compiles CEL expressions for a map of properties
func compileProperties(env *cel.Env, properties map[string]string) (map[string]cel.Program, error) {
	compiled := make(map[string]cel.Program)
	for key, expr := range properties {
		prg, err := celutils.CompilePropertyExpression(env, expr)
		if err != nil {
			return nil, fmt.Errorf("failed to compile property '%s': %w", key, err)
		}
		compiled[key] = prg
	}
	return compiled, nil
}

// Validate performs validation on the entire configuration
func (esc *EventStreamingConfig) Validate(pbPkgName *string, pbFd protoreflect.FileDescriptor) error {
	// Validate tracking configuration
	tablePattern := regexp.MustCompile(`^([a-zA-Z0-9_]+)\.(insert|update|delete)$`)
	for key, eventConfig := range esc.Track {
		matches := tablePattern.FindStringSubmatch(key)
		if matches == nil {
			return fmt.Errorf("invalid table operation format: %s", key)
		}
		tableName := matches[1]
		eventType := matches[2]

		// Create CEL environment for this table and event type
		baseEnvOpts := celutils.GenerateBaseCELEnvOptions(pbPkgName, pbFd, tableName, eventType)

		// Compile CEL expressions based on event type
		switch ec := eventConfig.EventConfig.(type) {
		case *SimpleEvent:
			env, err := celutils.CreateCELEnv(baseEnvOpts...)
			if err != nil {
				return fmt.Errorf("failed to create CEL environment for %s: %w", key, err)
			}
			// Compile properties for SimpleEvent
			ec.CompiledProperties, err = compileProperties(env, ec.Properties)
			if err != nil {
				return fmt.Errorf("failed to compile properties for %s: %w", key, err)
			}

		case *ConditionalEvent:
			var err error
			ec.CondEventsPbFd, err = celutils.GenerateEventRefPb(ec.GetEventNames())
			if err != nil {
				return fmt.Errorf("failed to create CEL environment for %s: %w", key, err)
			}
			eventsEnvOpts, err := celutils.GenerateCELEventsOptionsFromPbFd(ec.CondEventsPbFd)
			if err != nil {
				return fmt.Errorf("failed to create CEL environment for %s: %w", key, err)
			}
			env, err := celutils.CreateCELEnv(append(baseEnvOpts, eventsEnvOpts...)...)
			if err != nil {
				return fmt.Errorf("failed to create CEL environment for %s: %w", key, err)
			}
			// Compile condition
			ec.CompiledCond, err = celutils.CompileEventCondition(env, ec.Cond)
			if err != nil {
				return fmt.Errorf("failed to compile condition for %s: %w", key, err)
			}

			// Compile properties for each event in ConditionalEvent
			for eventName, event := range ec.Events {
				event.CompiledProperties, err = compileProperties(env, event.Properties)
				if err != nil {
					return fmt.Errorf("failed to compile properties for %s.%s: %w", key, eventName, err)
				}
				ec.Events[eventName] = event
			}
		}
	}

	// Validate destinations
	for destKey, dest := range esc.Destinations {
		if err := dest.Validate(); err != nil {
			return fmt.Errorf("destination validation failed: %w", err)
		}
		// Update the original map with any changes made during validation
		esc.Destinations[destKey] = dest
	}

	return nil
}

func (esc *EventStreamingConfig) GetInitializedDestinations(logger *slog.Logger) ([]InitializedProcessedEventDestination, error) {
	initializedDestinations := make([]InitializedProcessedEventDestination, 0, len(esc.Destinations))
	for kind, destination := range esc.Destinations {
		switch kind {
		case "mixpanel":
			mp, err := destinations.NewMixpanelDestination(destination.APIKey, logger)
			if err != nil {
				return nil, fmt.Errorf("failed to create mixpanel destination: %w", err)
			}
			initializedDestinations = append(initializedDestinations, InitializedProcessedEventDestination{
				Kind:        kind,
				Filter:      destination.Filter,
				Destination: mp,
			})
		default:
			return nil, fmt.Errorf("unknown destination type: %s", kind)
		}
	}
	return initializedDestinations, nil
}

// ParseEventStreamingConfig parses and validates a YAML configuration
func ParseEventStreamingConfig(path string) (*EventStreamingConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	config := &EventStreamingConfig{}

	if err := yaml.Unmarshal(data, config); err != nil {
		return nil, fmt.Errorf("failed to parse YAML: %w", err)
	}

	if err := config.Validate(nil, nil); err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}

	return config, nil
}
