export type ColumnType = string;

export interface ColumnAttributes {
  autoIncrement?: boolean;
}

export interface ColumnConstraints {
  notNull?: boolean;
}

export interface Column {
  name: string;
  type: ColumnType;
  default: string | null;
  attributes: ColumnAttributes | null;
  constraints: ColumnConstraints | null;
}

export interface Index {
  name: string;
  type: string;
  columns: string[];
  isUnique: boolean;
}

export interface Trigger {
  name: string;
  events: string[];
  arguments: string[];
  condition: string | null;
  forEachRow: boolean;
  executeProcedure: string;
  forEachStatement: boolean;
  constraintTrigger: boolean;
}

export interface ForeignKey {
  name: string;
  columns: string[];
  onDelete: string;
  references: {
    table: string;
    columns: string[];
  };
}

export interface Table {
  name: string;
  columns: Column[];
  indexes: Index[] | null;
  triggers: Trigger[] | null;
  isDeleted: boolean;
  primaryKey: string[];
  foreignKeys: ForeignKey[] | null;
}

export type DatabaseSchema = Table[];
