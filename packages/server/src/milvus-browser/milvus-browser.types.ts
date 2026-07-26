export type CollectionSummary = {
  name: string;
  rowCount: number | null;
  loaded: boolean | null;
};

export type FieldSchemaView = {
  name: string;
  dataType: string;
  isPrimaryKey: boolean;
  dim?: number;
};

export type IndexSchemaView = {
  fieldName: string;
  indexName: string;
  indexType?: string;
  metricType?: string;
};

export type CollectionSchemaView = {
  name: string;
  fields: FieldSchemaView[];
  indexes: IndexSchemaView[];
  vectorFields: string[];
};

export type ListEntitiesOptions = {
  limit: number;
  offset: number;
  fullVector: boolean;
};

export type QueryEntitiesOptions = {
  expr: string;
  outputFields?: string[];
  limit: number;
  fullVector: boolean;
};
