/*
Copyright 2019 The SchemaHero Authors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package schemas

import (
	"fmt"
	"path/filepath"
	"strings"

	"github.com/typeeng/pg_track_events/agent/internal/config"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protodesc"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/reflect/protoregistry"
	"google.golang.org/protobuf/types/descriptorpb"
	_ "google.golang.org/protobuf/types/known/anypb"
)

type PostgresqlTableTrigger struct {
	Name              string   `json:"name" yaml:"name"`
	ConstraintTrigger *bool    `json:"constraintTrigger" yaml:"constraintTrigger"`
	Events            []string `json:"events" yaml:"events"`
	ForEachStatement  *bool    `json:"forEachStatement" yaml:"forEachStatement"`
	ForEachRow        *bool    `json:"forEachRow" yaml:"forEachRow"`
	Condition         *string  `json:"condition" yaml:"condition"`
	ExecuteProcedure  string   `json:"executeProcedure" yaml:"executeProcedure"`
	Arguments         []string `json:"arguments" yaml:"arguments"`
}

type PostgresqlTableForeignKeyReferences struct {
	Table   string   `json:"table"`
	Columns []string `json:"columns"`
}

type PostgresqlTableForeignKey struct {
	Columns    []string                            `json:"columns" yaml:"columns"`
	References PostgresqlTableForeignKeyReferences `json:"references" yaml:"references"`
	OnDelete   string                              `json:"onDelete" yaml:"onDelete"`
	Name       string                              `json:"name" yaml:"name"`
}

type PostgresqlTableIndex struct {
	Columns  []string `json:"columns" yaml:"columns"`
	Name     string   `json:"name" yaml:"name"`
	IsUnique bool     `json:"isUnique" yaml:"isUnique"`
	Type     string   `json:"type" yaml:"type"`
}

type PostgresqlTableColumnConstraints struct {
	NotNull *bool `json:"notNull" yaml:"notNull"`
}

type PostgresqlTableColumnAttributes struct {
	AutoIncrement *bool `json:"autoIncrement" yaml:"autoIncrement"`
}

type PostgresqlTableColumn struct {
	Name        string                            `json:"name" yaml:"name"`
	Type        string                            `json:"type" yaml:"type"`
	Constraints *PostgresqlTableColumnConstraints `json:"constraints" yaml:"constraints"`
	Attributes  *PostgresqlTableColumnAttributes  `json:"attributes" yaml:"attributes"`
	Default     *string                           `json:"default" yaml:"default"`
}

type PostgresqlTableSchema struct {
	Name        string                       `json:"name" yaml:"name"`
	PrimaryKey  []string                     `json:"primaryKey" yaml:"primaryKey"`
	ForeignKeys []*PostgresqlTableForeignKey `json:"foreignKeys" yaml:"foreignKeys"`
	Indexes     []*PostgresqlTableIndex      `json:"indexes" yaml:"indexes"`
	Columns     []*PostgresqlTableColumn     `json:"columns" yaml:"columns"`
	IsDeleted   bool                         `json:"isDeleted" yaml:"isDeleted"`
	Triggers    []*PostgresqlTableTrigger    `json:"triggers" yaml:"triggers"`
}

type PostgresqlTableSchemaList []*PostgresqlTableSchema

// getBaseTypeAndDimensions extracts the base type and number of dimensions from a PostgreSQL type
func getBaseTypeAndDimensions(pgType string) (baseType string, dimensions int) {
	dimensions = 0
	baseType = pgType
	for strings.HasSuffix(baseType, "[]") {
		dimensions++
		baseType = strings.TrimSuffix(baseType, "[]")
	}
	return baseType, dimensions
}

// mapPostgresTypeToProto maps a PostgreSQL type to its protobuf equivalent
func mapPostgresTypeToProto(pgType string) (fieldType *descriptorpb.FieldDescriptorProto_Type, typeName *string) {
	baseType, _ := getBaseTypeAndDimensions(pgType)

	// Map base types to protobuf types
	switch baseType {
	case "integer", "bigint", "serial", "bigserial", "smallint", "smallserial":
		return descriptorpb.FieldDescriptorProto_TYPE_INT64.Enum(), nil
	case "text", "varchar", "char", "character varying", "uuid", "money", "xml",
		"timestamp", "timestamptz", "date", "time", "timetz", "interval",
		"cidr", "inet", "macaddr", "macaddr8",
		"point", "line", "lseg", "box", "path", "polygon", "circle":
		return descriptorpb.FieldDescriptorProto_TYPE_STRING.Enum(), nil
	case "boolean":
		return descriptorpb.FieldDescriptorProto_TYPE_BOOL.Enum(), nil
	case "double precision", "real", "numeric", "decimal":
		return descriptorpb.FieldDescriptorProto_TYPE_DOUBLE.Enum(), nil
	case "bytea", "bit", "bit varying":
		return descriptorpb.FieldDescriptorProto_TYPE_BYTES.Enum(), nil
	case "json", "jsonb", "hstore":
		return descriptorpb.FieldDescriptorProto_TYPE_MESSAGE.Enum(), proto.String(".google.protobuf.Value")
	default:
		// For unknown types, use Value
		return descriptorpb.FieldDescriptorProto_TYPE_MESSAGE.Enum(), proto.String(".google.protobuf.Value")
	}
}

// createFieldDescriptor creates a protobuf field descriptor from a PostgreSQL column
func (column *PostgresqlTableColumn) createFieldDescriptor(fieldNumber int32) *descriptorpb.FieldDescriptorProto {
	field := &descriptorpb.FieldDescriptorProto{
		Name:   proto.String(column.Name),
		Number: proto.Int32(fieldNumber),
	}

	// NOTE: Protobuf v3 doesn't support required fields so we don't add those labels
	//       Learn more: https://stackoverflow.com/questions/31801257/why-required-and-optional-is-removed-in-protocol-buffers-3

	// Get the base type and number of dimensions
	_, dimensions := getBaseTypeAndDimensions(column.Type)
	if dimensions > 0 {
		// NOTE: Protobuf arrays are too restrictive compared to PostgreSQL arrays
		//       so we use a message instead. TODO Revisit for better type checking.
		field.Type = descriptorpb.FieldDescriptorProto_TYPE_MESSAGE.Enum()
		field.TypeName = proto.String(".google.protobuf.Value")
	} else {
		field.Type, field.TypeName = mapPostgresTypeToProto(column.Type)
	}

	return field
}

// createMessageDescriptor creates a protobuf message descriptor from a PostgreSQL table
func (table *PostgresqlTableSchema) createMessageDescriptor() *descriptorpb.DescriptorProto {
	msgName := table.Name
	if strings.Contains(msgName, ".") {
		msgName = strings.SplitN(msgName, ".", 2)[1]
	}
	msg := &descriptorpb.DescriptorProto{
		Name: proto.String(msgName),
	}

	// Add fields for each column
	for i, column := range table.Columns {
		field := column.createFieldDescriptor(int32(i + 1))
		msg.Field = append(msg.Field, field)
	}

	return msg
}

// ApplyIgnoresToSchema applies the ignores to the schema
func (s PostgresqlTableSchemaList) ApplyIgnoresToSchema(ignore map[string]config.ColumnIgnoreConfig) PostgresqlTableSchemaList {
	if len(ignore) == 0 {
		return s
	}

	result := make(PostgresqlTableSchemaList, 0, len(s))
	for _, table := range s {
		// Extract table name without schema prefix if present
		tableName := table.Name
		if strings.Contains(tableName, ".") {
			tableName = strings.SplitN(tableName, ".", 2)[1]
		}

		// Skip tables that are fully ignored
		if config, exists := ignore[tableName]; exists && config.AllColumns {
			continue
		}

		// Process tables with specific column ignores
		if config, exists := ignore[tableName]; exists && len(config.Columns) > 0 {
			// Create a map of ignored columns for faster lookup
			ignoredColumns := make(map[string]struct{})
			for _, col := range config.Columns {
				ignoredColumns[col] = struct{}{}
			}

			// Filter out ignored columns
			filteredColumns := make([]*PostgresqlTableColumn, 0, len(table.Columns))
			for _, column := range table.Columns {
				if _, ignored := ignoredColumns[column.Name]; !ignored {
					filteredColumns = append(filteredColumns, column)
				}
			}
			table.Columns = filteredColumns
		}

		result = append(result, table)
	}

	return result
}

// GeneratePbDescriptorForTables generates protobuf descriptors for all tables matching the given glob pattern
func (s PostgresqlTableSchemaList) GeneratePbDescriptorForTables(pbPkgName, tableNameGlob string) (protoreflect.FileDescriptor, error) {
	// Create a new file descriptor proto
	f := &descriptorpb.FileDescriptorProto{
		Name:       proto.String(pbPkgName + "_pg_schema.proto"),
		Syntax:     proto.String("proto3"),
		Package:    proto.String(pbPkgName),
		Dependency: []string{"google/protobuf/struct.proto"},
	}

	// Convert each table to a message descriptor
	for _, table := range s {
		// Skip if table is marked as deleted
		if table.IsDeleted {
			continue
		}

		// Check if table name matches the glob pattern
		matches, err := filepath.Match(tableNameGlob, table.Name)
		if err != nil {
			return nil, fmt.Errorf("invalid glob pattern: %w", err)
		}
		if !matches {
			continue
		}

		msg := table.createMessageDescriptor()
		f.MessageType = append(f.MessageType, msg)
	}

	fd, err := protodesc.NewFile(f, protoregistry.GlobalFiles)
	if err != nil {
		return nil, fmt.Errorf("failed to create file descriptor: %w", err)
	}

	return fd, nil
}
