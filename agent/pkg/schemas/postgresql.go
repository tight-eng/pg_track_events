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

// createFieldDescriptor creates a protobuf field descriptor from a PostgreSQL column
func (column *PostgresqlTableColumn) createFieldDescriptor(fieldNumber int32) *descriptorpb.FieldDescriptorProto {
	field := &descriptorpb.FieldDescriptorProto{
		Name:   proto.String(column.Name),
		Number: proto.Int32(fieldNumber),
	}

	// Map PostgreSQL types to protobuf types
	switch column.Type {
	case "integer", "bigint", "serial", "bigserial":
		field.Type = descriptorpb.FieldDescriptorProto_TYPE_INT64.Enum()
	case "text", "varchar", "char", "character varying":
		field.Type = descriptorpb.FieldDescriptorProto_TYPE_STRING.Enum()
	case "boolean":
		field.Type = descriptorpb.FieldDescriptorProto_TYPE_BOOL.Enum()
	case "double precision", "real":
		field.Type = descriptorpb.FieldDescriptorProto_TYPE_DOUBLE.Enum()
	case "timestamp", "timestamptz", "date":
		// TODO Do we want to give special treatment to timestamp/timestamptz?
		field.Type = descriptorpb.FieldDescriptorProto_TYPE_STRING.Enum()
	case "json", "jsonb":
		field.Type = descriptorpb.FieldDescriptorProto_TYPE_MESSAGE.Enum()
		field.TypeName = proto.String(".google.protobuf.Value")
	default:
		// Default to string for unknown types
		field.Type = descriptorpb.FieldDescriptorProto_TYPE_STRING.Enum()
	}

	// NOTE: Protobuf v3 doesn't support required fields so we don't add those labels
	//       Learn more: https://stackoverflow.com/questions/31801257/why-required-and-optional-is-removed-in-protocol-buffers-3

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
