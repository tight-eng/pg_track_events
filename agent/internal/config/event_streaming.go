package config

import (
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/google/cel-go/cel"
	"github.com/typeeng/tight-agent/internal/env"
	"github.com/typeeng/tight-agent/pkg/celutils"
	"github.com/typeeng/tight-agent/pkg/destinations"
	"github.com/typeeng/tight-agent/pkg/eventmodels"
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
	// All destinations will be filtered by this pattern
	Filter string `yaml:"filter,omitempty"`
	// API Key (generic)
	APIKey string `yaml:"apiKey,omitempty"`
	// Project Token (Mixpanel)
	ProjectToken string `yaml:"projectToken,omitempty"`
	// BigQuery specific configuration
	TableID         string `yaml:"tableId,omitempty"`
	CredentialsJSON string `yaml:"credentialsJson,omitempty"`
}

type InitializedProcessedEventDestination struct {
	Kind        string
	Filter      string
	Destination destinations.ProcessedEventDestination
}

type InitializedDBEventDestination struct {
	Kind        string
	Filter      string
	Destination destinations.DBEventDestination
}

// Validate checks if the APIKey is in the correct format
func (dc *DestinationConfig) Validate(destKey string) error {
	var err error
	if dc.Filter == "" {
		dc.Filter = "*"
	}
	dc.Filter = strings.TrimSpace(dc.Filter)
	if dc.Filter != "*" {
		if _, err := filepath.Match(dc.Filter, ""); err != nil {
			return fmt.Errorf("invalid filter pattern: %w", err)
		}
	}

	// Validate BigQuery specific configuration if present
	if destKey == "bigquery" {
		if dc.TableID, err = env.ValueOrRequiredEnvVar(dc.TableID); err != nil {
			return fmt.Errorf("table ID is required for BigQuery destination: %w", err)
		}
		if dc.CredentialsJSON, err = env.ValueOrRequiredEnvVar(dc.CredentialsJSON); err != nil {
			return fmt.Errorf("credentials JSON is required for BigQuery destination: %w", err)
		}
	} else if destKey == "mixpanel" {
		if dc.ProjectToken, err = env.ValueOrRequiredEnvVar(dc.ProjectToken); err != nil {
			return fmt.Errorf("project token is required for Mixpanel destination: %w", err)
		}
	} else if destKey == "amplitude" || destKey == "posthog" {
		if dc.APIKey, err = env.ValueOrRequiredEnvVar(dc.APIKey); err != nil {
			return fmt.Errorf("API key is required for %s destination: %w", destKey, err)
		}
	} else if destKey == "e2e_test_processed_events" || destKey == "e2e_test_db_events" {
		return nil
	} else {
		return fmt.Errorf("unknown destination type: %s", destKey)
	}
	return nil
}

// ColumnIgnoreConfig represents either all columns or specific columns to ignore
type ColumnIgnoreConfig struct {
	AllColumns bool
	Columns    []string
}

// UnmarshalYAML implements custom unmarshaling for ColumnIgnoreConfig
func (c *ColumnIgnoreConfig) UnmarshalYAML(value *yaml.Node) error {
	// Handle string case (for "*")
	if value.Kind == yaml.ScalarNode {
		if value.Value == "*" {
			c.AllColumns = true
			return nil
		}
		return fmt.Errorf("invalid ignore value: must be '*' or an array of column names")
	}

	// Handle array case
	if value.Kind == yaml.SequenceNode {
		columns := make([]string, len(value.Content))
		for i, node := range value.Content {
			if node.Kind != yaml.ScalarNode {
				return fmt.Errorf("column name must be a string")
			}
			columns[i] = node.Value
		}
		c.Columns = columns
		return nil
	}

	return fmt.Errorf("invalid ignore configuration: must be '*' or an array of column names")
}

// IgnoreConfig represents the configuration for ignoring specific columns in tables
type IgnoreConfig map[string]ColumnIgnoreConfig

// Validate performs validation on the ignore configuration
func (ic IgnoreConfig) Validate() error {
	for tableName, config := range ic {
		if config.AllColumns && len(config.Columns) > 0 {
			return fmt.Errorf("invalid ignore configuration for table %s: cannot specify both '*' and specific columns", tableName)
		}
		if !config.AllColumns && len(config.Columns) == 0 {
			return fmt.Errorf("invalid ignore configuration for table %s: must specify either '*' or specific columns", tableName)
		}
	}
	return nil
}

// EventStreamingConfig is the root configuration structure
type EventStreamingConfig struct {
	Track                  TrackingConfig               `yaml:"track"`
	Destinations           map[string]DestinationConfig `yaml:"destinations,omitempty"`
	RawDBEventDestinations map[string]DestinationConfig `yaml:"raw_db_event_destinations,omitempty"`
	Ignore                 IgnoreConfig                 `yaml:"ignore,omitempty"`

	// For testing
	E2eProcessedEventChan chan<- *eventmodels.ProcessedEvent
	E2eDBEventChan        chan<- *eventmodels.DBEvent
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
		if err := dest.Validate(destKey); err != nil {
			return fmt.Errorf("destination validation failed: %w", err)
		}
		// Update the original map with any changes made during validation
		esc.Destinations[destKey] = dest
	}

	for destKey, dest := range esc.RawDBEventDestinations {
		if err := dest.Validate(destKey); err != nil {
			return fmt.Errorf("raw db event destination validation failed: %w", err)
		}
		// Update the original map with any changes made during validation
		esc.RawDBEventDestinations[destKey] = dest
	}

	// Validate ignore configuration
	if err := esc.Ignore.Validate(); err != nil {
		return fmt.Errorf("ignore configuration validation failed: %w", err)
	}

	return nil
}

func (esc *EventStreamingConfig) GetInitializedDestinations(logger *slog.Logger) ([]InitializedProcessedEventDestination, []InitializedDBEventDestination, error) {
	initializedDestinations := make([]InitializedProcessedEventDestination, 0, len(esc.Destinations))
	initializedDBDestinations := make([]InitializedDBEventDestination, 0, len(esc.RawDBEventDestinations))
	for kind, destination := range esc.RawDBEventDestinations {
		switch kind {
		case "bigquery":
			bq, err := destinations.NewBigQueryRawDBEventDestination(
				destination.CredentialsJSON,
				destination.TableID,
				logger,
			)
			if err != nil {
				return nil, nil, fmt.Errorf("failed to create bigquery destination: %w", err)
			}
			initializedDBDestinations = append(initializedDBDestinations, InitializedDBEventDestination{
				Kind:        kind,
				Filter:      destination.Filter,
				Destination: bq,
			})
		default:
			return nil, nil, fmt.Errorf("unknown raw db event destination type: %s", kind)
		}
	}

	for kind, destination := range esc.Destinations {
		switch kind {
		case "e2e_test_processed_events":
			e2eDest := destinations.NewTestProcessedEventDestination(esc.E2eProcessedEventChan)
			initializedDestinations = append(initializedDestinations, InitializedProcessedEventDestination{
				Kind:        kind,
				Filter:      destination.Filter,
				Destination: e2eDest,
			})
		case "e2e_test_db_events":
			e2eDest := destinations.NewTestDBEventDestination(esc.E2eDBEventChan)
			initializedDBDestinations = append(initializedDBDestinations, InitializedDBEventDestination{
				Kind:        kind,
				Filter:      destination.Filter,
				Destination: e2eDest,
			})
		case "mixpanel":
			// TODO Review additional config options
			mp, err := destinations.NewMixpanelDestination(destination.ProjectToken, logger)
			if err != nil {
				return nil, nil, fmt.Errorf("failed to create mixpanel destination: %w", err)
			}
			initializedDestinations = append(initializedDestinations, InitializedProcessedEventDestination{
				Kind:        kind,
				Filter:      destination.Filter,
				Destination: mp,
			})
		case "posthog":
			// TODO Pull endpoint from config
			ph, err := destinations.NewPostHogDestination(destination.APIKey, "https://us.i.posthog.com", logger)
			if err != nil {
				return nil, nil, fmt.Errorf("failed to create posthog destination: %w", err)
			}
			initializedDestinations = append(initializedDestinations, InitializedProcessedEventDestination{
				Kind:        kind,
				Filter:      destination.Filter,
				Destination: ph,
			})
		case "amplitude":
			// TODO Pull endpoint from config
			amp, err := destinations.NewAmplitudeDestination(destination.APIKey, "https://api2.amplitude.com", logger)
			if err != nil {
				return nil, nil, fmt.Errorf("failed to create amplitude destination: %w", err)
			}
			initializedDestinations = append(initializedDestinations, InitializedProcessedEventDestination{
				Kind:        kind,
				Filter:      destination.Filter,
				Destination: amp,
			})
		case "bigquery":
			bq, err := destinations.NewBigQueryDestination(
				destination.CredentialsJSON,
				destination.TableID,
				logger,
			)
			if err != nil {
				return nil, nil, fmt.Errorf("failed to create bigquery destination: %w", err)
			}
			initializedDestinations = append(initializedDestinations, InitializedProcessedEventDestination{
				Kind:        kind,
				Filter:      destination.Filter,
				Destination: bq,
			})
		default:
			return nil, nil, fmt.Errorf("unknown destination type: %s", kind)
		}
	}
	return initializedDestinations, initializedDBDestinations, nil
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
