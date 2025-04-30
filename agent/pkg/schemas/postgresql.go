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
