export type MilvusCollectionSummary = {
  name: string;
  rowCount: number | null;
  loaded: boolean | null;
};

export type MilvusFieldSchema = {
  name: string;
  dataType: string;
  isPrimaryKey: boolean;
  dim?: number;
};

export type MilvusIndexSchema = {
  fieldName: string;
  indexName: string;
  indexType?: string;
  metricType?: string;
};

export type MilvusCollectionSchema = {
  name: string;
  fields: MilvusFieldSchema[];
  indexes: MilvusIndexSchema[];
  vectorFields: string[];
};

export type TruncatedVector =
  | { truncated: true; dim: number; preview: number[] }
  | { truncated: false; dim: number; values: number[] };
