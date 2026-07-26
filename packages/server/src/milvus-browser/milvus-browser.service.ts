import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Milvus } from '@langchain/community/vectorstores/milvus';
import { DataType, ErrorCode, MilvusClient } from '@zilliz/milvus2-sdk-node';
import { createEmbeddings } from '../rag/embeddings.factory';
import { RAG_COLLECTION_NAME } from '../rag/milvus.store';
import { mapEntityRow } from './vector-display';
import type {
  CollectionSchemaView,
  CollectionSummary,
  FieldSchemaView,
  IndexSchemaView,
  ListEntitiesOptions,
  QueryEntitiesOptions,
} from './milvus-browser.types';

type SchemaField = {
  name: string;
  data_type?: string | number;
  dataType?: DataType | string | number;
  is_primary_key?: boolean;
  type_params?: unknown;
  dim?: string | number;
};

const VECTOR_TYPE_NAMES = new Set([
  'BinaryVector',
  'FloatVector',
  'Float16Vector',
  'BFloat16Vector',
  'SparseFloatVector',
  'Int8Vector',
  'ArrayOfVector',
]);

@Injectable()
export class MilvusBrowserService {
  private readonly logger = new Logger(MilvusBrowserService.name);
  private client: MilvusClient | null = null;

  constructor(private readonly config: ConfigService) {}

  private getClient(): MilvusClient {
    if (!this.client) {
      const raw = this.config.get<string>('MILVUS_URI', 'http://localhost:19530');
      const address = raw.replace(/^https?:\/\//, '');
      this.client = new MilvusClient({ address });
    }
    return this.client;
  }

  private isConnectionError(err: unknown): boolean {
    const message = err instanceof Error ? err.message : String(err);
    return /ECONNREFUSED|ENOTFOUND|ECONNRESET|UNAVAILABLE|failed to connect|connect ECONNREFUSED|14 UNAVAILABLE|DEADLINE_EXCEEDED|DNS|timeout|channel closed|UNIMPLEMENTED/i.test(
      message,
    );
  }

  private rethrow(err: unknown): never {
    if (
      err instanceof BadRequestException ||
      err instanceof NotFoundException ||
      err instanceof ServiceUnavailableException
    ) {
      throw err;
    }
    if (this.isConnectionError(err)) {
      throw new ServiceUnavailableException('无法连接 Milvus，请确认服务已启动');
    }
    throw err instanceof Error ? err : new Error(String(err));
  }

  private async withClient<T>(fn: (client: MilvusClient) => Promise<T>): Promise<T> {
    try {
      return await fn(this.getClient());
    } catch (err) {
      this.rethrow(err);
    }
  }

  private dataTypeName(field: SchemaField): string {
    if (typeof field.data_type === 'string' && field.data_type) {
      return field.data_type;
    }
    if (typeof field.dataType === 'string' && field.dataType) {
      return field.dataType;
    }
    const numeric =
      typeof field.dataType === 'number'
        ? field.dataType
        : typeof field.data_type === 'number'
          ? field.data_type
          : undefined;
    if (numeric !== undefined) {
      const named = DataType[numeric as DataType];
      if (typeof named === 'string') return named;
    }
    return 'Unknown';
  }

  private isVectorField(field: SchemaField): boolean {
    const name = this.dataTypeName(field);
    if (VECTOR_TYPE_NAMES.has(name)) return true;
    if (/vector/i.test(name)) return true;
    const numeric =
      typeof field.dataType === 'number'
        ? field.dataType
        : typeof field.data_type === 'number'
          ? field.data_type
          : undefined;
    return (
      numeric === DataType.FloatVector ||
      numeric === DataType.BinaryVector ||
      numeric === DataType.Float16Vector ||
      numeric === DataType.BFloat16Vector ||
      numeric === DataType.SparseFloatVector ||
      numeric === DataType.Int8Vector ||
      numeric === DataType.ArrayOfVector
    );
  }

  private readDim(field: SchemaField): number | undefined {
    if (field.dim !== undefined) {
      const n = typeof field.dim === 'number' ? field.dim : Number.parseInt(String(field.dim), 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
    const params = field.type_params;
    if (Array.isArray(params)) {
      for (const pair of params) {
        const key = (pair as { key?: string }).key;
        const value = (pair as { value?: string }).value;
        if (key === 'dim' && value !== undefined) {
          const n = Number.parseInt(String(value), 10);
          if (Number.isFinite(n) && n > 0) return n;
        }
      }
    } else if (params && typeof params === 'object' && 'dim' in params) {
      const n = Number.parseInt(String((params as { dim: unknown }).dim), 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return undefined;
  }

  private mapFields(fields: SchemaField[]): FieldSchemaView[] {
    return fields.map((field) => {
      const view: FieldSchemaView = {
        name: field.name,
        dataType: this.dataTypeName(field),
        isPrimaryKey: Boolean(field.is_primary_key),
      };
      const dim = this.readDim(field);
      if (dim !== undefined) view.dim = dim;
      return view;
    });
  }

  private async assertCollectionExists(client: MilvusClient, name: string): Promise<void> {
    const hasColResp = await client.hasCollection({ collection_name: name });
    if (hasColResp.status.error_code !== ErrorCode.SUCCESS) {
      throw new Error(`Error checking collection: ${JSON.stringify(hasColResp)}`);
    }
    if (!hasColResp.value) {
      throw new NotFoundException(`collection「${name}」不存在`);
    }
  }

  private async ensureLoaded(client: MilvusClient, name: string): Promise<void> {
    await this.assertCollectionExists(client, name);
    const loadResp = await client.loadCollectionSync({ collection_name: name });
    if (loadResp.error_code !== ErrorCode.SUCCESS) {
      throw new Error(`Error loading collection: ${JSON.stringify(loadResp)}`);
    }
  }

  private async describeRaw(client: MilvusClient, name: string) {
    await this.assertCollectionExists(client, name);
    const desc = await client.describeCollection({ collection_name: name });
    if (desc.status.error_code !== ErrorCode.SUCCESS) {
      throw new Error(`Error describing collection: ${JSON.stringify(desc.status)}`);
    }
    return desc;
  }

  private async listIndexesSafe(client: MilvusClient, name: string): Promise<IndexSchemaView[]> {
    try {
      const resp = await client.describeIndex({ collection_name: name });
      if (resp.status.error_code !== ErrorCode.SUCCESS) {
        return [];
      }
      return (resp.index_descriptions ?? []).map((idx) => {
        const params = idx.params ?? [];
        const findParam = (key: string) =>
          params.find((p) => p.key === key)?.value ??
          params.find((p) => p.key?.toLowerCase() === key.toLowerCase())?.value;
        const indexType = findParam('index_type');
        const metricType = findParam('metric_type');
        const view: IndexSchemaView = {
          fieldName: idx.field_name,
          indexName: idx.index_name,
        };
        if (indexType) view.indexType = String(indexType);
        if (metricType) view.metricType = String(metricType);
        return view;
      });
    } catch (err) {
      this.logger.debug(
        `describeIndex failed for ${name}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }
  }

  private buildListExpr(pk: SchemaField): string {
    const name = pk.name;
    const typeName = this.dataTypeName(pk);
    if (typeName === 'VarChar' || typeName === 'String') {
      return `${name} != ""`;
    }
    return `${name} >= 0`;
  }

  private async getRowCount(client: MilvusClient, name: string): Promise<number | null> {
    try {
      const stats = await client.getCollectionStatistics({ collection_name: name });
      if (stats.status.error_code !== ErrorCode.SUCCESS) return null;
      const fromData = stats.data?.row_count ?? stats.data?.rowCount;
      if (fromData !== undefined) {
        const n = Number(fromData);
        if (Number.isFinite(n)) return n;
      }
      const pair = (stats.stats ?? []).find(
        (p) => p.key === 'row_count' || p.key === 'rowCount',
      );
      if (pair?.value !== undefined) {
        const n = Number(pair.value);
        if (Number.isFinite(n)) return n;
      }
      return null;
    } catch {
      return null;
    }
  }

  private async getLoaded(client: MilvusClient, name: string): Promise<boolean | null> {
    try {
      const progress = await client.getLoadingProgress({ collection_name: name });
      if (progress.status.error_code !== ErrorCode.SUCCESS) return null;
      const n = Number.parseInt(String(progress.progress ?? ''), 10);
      if (!Number.isFinite(n)) return null;
      return n >= 100;
    } catch {
      return null;
    }
  }

  async listCollections(): Promise<{ items: CollectionSummary[] }> {
    return this.withClient(async (client) => {
      const shown = await client.showCollections();
      if (shown.status.error_code !== ErrorCode.SUCCESS) {
        throw new Error(`Error listing collections: ${JSON.stringify(shown.status)}`);
      }
      const names = (shown.data ?? []).map((c) => c.name);
      const items: CollectionSummary[] = [];
      for (const name of names) {
        const [rowCount, loaded] = await Promise.all([
          this.getRowCount(client, name),
          this.getLoaded(client, name),
        ]);
        items.push({ name, rowCount, loaded });
      }
      return { items };
    });
  }

  async getSchema(name: string): Promise<CollectionSchemaView> {
    return this.withClient(async (client) => {
      const desc = await this.describeRaw(client, name);
      const fieldsRaw = (desc.schema?.fields ?? []) as SchemaField[];
      const fields = this.mapFields(fieldsRaw);
      const vectorFields = fieldsRaw.filter((f) => this.isVectorField(f)).map((f) => f.name);
      const indexes = await this.listIndexesSafe(client, name);
      return {
        name: desc.collection_name || name,
        fields,
        indexes,
        vectorFields,
      };
    });
  }

  async listEntities(name: string, options: ListEntitiesOptions) {
    return this.withClient(async (client) => {
      await this.ensureLoaded(client, name);
      const desc = await this.describeRaw(client, name);
      const fieldsRaw = (desc.schema?.fields ?? []) as SchemaField[];
      const pk = fieldsRaw.find((f) => f.is_primary_key);
      if (!pk) {
        throw new BadRequestException(`collection「${name}」缺少主键字段`);
      }
      const vectorFields = fieldsRaw.filter((f) => this.isVectorField(f)).map((f) => f.name);
      const outputFields = fieldsRaw.map((f) => f.name);
      const expr = this.buildListExpr(pk);

      const resp = await client.query({
        collection_name: name,
        expr,
        output_fields: outputFields.length > 0 ? outputFields : ['*'],
        limit: options.limit,
        offset: options.offset,
      });

      if (resp.status.error_code !== ErrorCode.SUCCESS) {
        throw new Error(`Error querying entities: ${JSON.stringify(resp.status)}`);
      }

      const rows = (resp.data ?? []).map((row) =>
        mapEntityRow(row as Record<string, unknown>, vectorFields, options.fullVector),
      );

      return {
        rows,
        limit: options.limit,
        offset: options.offset,
      };
    });
  }

  async query(name: string, options: QueryEntitiesOptions) {
    const expr = (options.expr ?? '').trim();
    if (!expr) {
      throw new BadRequestException('expr 不能为空');
    }

    return this.withClient(async (client) => {
      await this.ensureLoaded(client, name);
      const desc = await this.describeRaw(client, name);
      const fieldsRaw = (desc.schema?.fields ?? []) as SchemaField[];
      const vectorFields = fieldsRaw.filter((f) => this.isVectorField(f)).map((f) => f.name);
      const allFields = fieldsRaw.map((f) => f.name);
      const outputFields =
        options.outputFields && options.outputFields.length > 0
          ? options.outputFields
          : allFields.length > 0
            ? allFields
            : ['*'];

      const resp = await client.query({
        collection_name: name,
        expr,
        output_fields: outputFields,
        limit: options.limit,
      });

      if (resp.status.error_code !== ErrorCode.SUCCESS) {
        throw new Error(`Error querying collection: ${JSON.stringify(resp.status)}`);
      }

      const rows = (resp.data ?? []).map((row) =>
        mapEntityRow(row as Record<string, unknown>, vectorFields, options.fullVector),
      );

      return { rows };
    });
  }

  async search(name: string, input: { query: string; topK?: number }) {
    if (name !== RAG_COLLECTION_NAME) {
      throw new BadRequestException(
        `自然语言 Search 仅支持 collection「${RAG_COLLECTION_NAME}」`,
      );
    }
    const q = (input.query ?? '').trim();
    if (!q) throw new BadRequestException('query 不能为空');
    const rawTopK = Number(input.topK);
    const topK = Number.isFinite(rawTopK)
      ? Math.min(Math.max(Math.trunc(rawTopK), 1), 50)
      : 6;

    return this.withClient(async (client) => {
      await this.assertCollectionExists(client, name);
      const embeddings = createEmbeddings(this.config);
      const url = this.config.get<string>('MILVUS_URI', 'http://localhost:19530');
      const store = await Milvus.fromExistingCollection(embeddings, {
        collectionName: RAG_COLLECTION_NAME,
        url,
      });
      const results = await store.similaritySearchWithScore(q, topK);
      return {
        rows: results.map(([doc, score]) => ({
          text: doc.pageContent,
          score,
          ...doc.metadata,
        })),
      };
    });
  }
}
