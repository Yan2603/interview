import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Document } from '@langchain/core/documents';
import { Milvus } from '@langchain/community/vectorstores/milvus';
import { ErrorCode } from '@zilliz/milvus2-sdk-node';
import { createEmbeddings } from './embeddings.factory';
import { createTextSplitter } from './text-splitter';
import {
  buildSourceFilter,
  buildSourceTypeFilter,
  getOrCreateMilvusStore,
  mapScoredDocuments,
  RAG_COLLECTION_NAME,
} from './milvus.store';

/** LangChain Milvus store exposes the SDK client; typed loosely for load/has helpers. */
type MilvusWithClient = Milvus & {
  client: {
    hasCollection: (req: { collection_name: string }) => Promise<{
      value: boolean;
      status: { error_code: string };
    }>;
    loadCollectionSync: (req: { collection_name: string }) => Promise<{
      error_code: string;
    }>;
    query: (req: {
      collection_name: string;
      filter?: string;
      expr?: string;
      output_fields: string[];
      limit?: number;
    }) => Promise<{
      status: { error_code: string };
      data?: Record<string, unknown>[];
    }>;
  };
  collectionName: string;
  textField?: string;
};

export type RagChunkRow = {
  sourceType: string;
  sourceId: string;
  title: string;
  chunkIndex: number;
  text: string;
  categorySlug?: string;
};

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private vectorStore: Milvus | null = null;
  private readonly splitter = createTextSplitter();

  constructor(private readonly config: ConfigService) {}

  async getVectorStore(): Promise<Milvus> {
    if (this.vectorStore) {
      return this.vectorStore;
    }

    const url = this.config.get<string>('MILVUS_URI', 'http://localhost:19530');
    const embeddings = createEmbeddings(this.config);

    this.logger.log(
      `Connecting Milvus collection=${RAG_COLLECTION_NAME} url=${url}`,
    );

    this.vectorStore = await getOrCreateMilvusStore(embeddings, {
      url,
      collectionName: RAG_COLLECTION_NAME,
    });
    return this.vectorStore;
  }

  async splitDocuments(docs: Document[]): Promise<Document[]> {
    return this.splitter.splitDocuments(docs);
  }

  async addDocuments(docs: Document[]): Promise<void> {
    if (docs.length === 0) {
      return;
    }
    const store = await this.getVectorStore();
    await store.addDocuments(docs);
    // Inserts may leave collection unloaded; load so subsequent deletes/search work.
    await this.ensureCollectionLoaded(store);
  }

  async deleteBySource(sourceType: string, sourceId: string): Promise<void> {
    const store = await this.getVectorStore();
    const filter = buildSourceFilter(sourceType, sourceId);
    await this.deleteWithLoad(store, filter, `deleteBySource(${sourceType}/${sourceId})`);
  }

  /** Delete all vectors for a sourceType (full reindex orphan cleanup). */
  async deleteBySourceType(sourceType: string): Promise<void> {
    const store = await this.getVectorStore();
    const filter = buildSourceTypeFilter(sourceType);
    await this.deleteWithLoad(store, filter, `deleteBySourceType(${sourceType})`);
  }

  async retrieve(query: string, k = 6): Promise<Document[]> {
    const store = await this.getVectorStore();

    try {
      const results = await store.similaritySearchWithScore(query, k);
      return mapScoredDocuments(results);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/collection not found/i.test(message)) {
        this.logger.warn('retrieve returned empty; collection not created yet');
        return [];
      }
      throw err;
    }
  }

  /** List stored chunks for a sourceType (for index status UI). */
  async listChunksBySourceType(sourceType: string): Promise<RagChunkRow[]> {
    const store = await this.getVectorStore();
    const exists = await this.ensureCollectionLoaded(store);
    if (!exists) return [];

    const milvus = store as MilvusWithClient;
    const collectionName = milvus.collectionName || RAG_COLLECTION_NAME;
    const textField = milvus.textField || 'text';
    const filter = buildSourceTypeFilter(sourceType);

    const resp = await milvus.client.query({
      collection_name: collectionName,
      filter,
      expr: filter,
      output_fields: ['sourceType', 'sourceId', 'title', 'chunkIndex', 'categorySlug', textField],
      limit: 16384,
    });

    if (resp.status.error_code !== ErrorCode.SUCCESS) {
      throw new Error(`Error querying chunks: ${JSON.stringify(resp.status)}`);
    }

    const rows = resp.data ?? [];
    return rows.map((row) => {
      const chunkRaw = row.chunkIndex;
      const chunkIndex =
        typeof chunkRaw === 'number'
          ? chunkRaw
          : Number.parseInt(String(chunkRaw ?? 0), 10) || 0;
      return {
        sourceType: String(row.sourceType ?? sourceType),
        sourceId: String(row.sourceId ?? ''),
        title: String(row.title ?? ''),
        chunkIndex,
        text: String(row[textField] ?? ''),
        categorySlug:
          row.categorySlug !== undefined && row.categorySlug !== null
            ? String(row.categorySlug)
            : undefined,
      };
    });
  }

  /**
   * LangChain Milvus.delete() does not load the collection; Milvus then returns
   * `collection not loaded`. Load first (no-op if already loaded).
   * @returns false if collection does not exist yet
   */
  private async ensureCollectionLoaded(store: Milvus): Promise<boolean> {
    const milvus = store as MilvusWithClient;
    const collectionName = milvus.collectionName || RAG_COLLECTION_NAME;

    const hasColResp = await milvus.client.hasCollection({
      collection_name: collectionName,
    });
    if (hasColResp.status.error_code !== ErrorCode.SUCCESS) {
      throw new Error(`Error checking collection: ${JSON.stringify(hasColResp)}`);
    }
    if (!hasColResp.value) {
      return false;
    }

    const loadResp = await milvus.client.loadCollectionSync({
      collection_name: collectionName,
    });
    if (loadResp.error_code !== ErrorCode.SUCCESS) {
      throw new Error(`Error loading collection: ${JSON.stringify(loadResp)}`);
    }
    return true;
  }

  private async deleteWithLoad(
    store: Milvus,
    filter: string,
    label: string,
  ): Promise<void> {
    try {
      const exists = await this.ensureCollectionLoaded(store);
      if (!exists) {
        this.logger.warn(`${label} skipped; collection missing`);
        return;
      }
      await store.delete({ filter });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/collection not found/i.test(message)) {
        this.logger.warn(`${label} skipped; collection missing`);
        return;
      }
      // Race: unloaded between ensure and delete — load once more and retry.
      if (/collection not loaded/i.test(message)) {
        this.logger.warn(`${label}: collection not loaded, retrying after load`);
        const exists = await this.ensureCollectionLoaded(store);
        if (!exists) {
          this.logger.warn(`${label} skipped; collection missing after retry`);
          return;
        }
        await store.delete({ filter });
        return;
      }
      throw err;
    }
  }
}
