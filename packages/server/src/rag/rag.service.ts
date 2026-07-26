import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Document } from '@langchain/core/documents';
import { Milvus } from '@langchain/community/vectorstores/milvus';
import { createEmbeddings } from './embeddings.factory';
import { createTextSplitter } from './text-splitter';
import {
  buildSourceFilter,
  getOrCreateMilvusStore,
  mapScoredDocuments,
  RAG_COLLECTION_NAME,
} from './milvus.store';

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
  }

  async deleteBySource(sourceType: string, sourceId: string): Promise<void> {
    const store = await this.getVectorStore();
    const filter = buildSourceFilter(sourceType, sourceId);

    try {
      await store.delete({ filter });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/collection not found/i.test(message)) {
        this.logger.warn(
          `deleteBySource skipped; collection missing (${sourceType}/${sourceId})`,
        );
        return;
      }
      throw err;
    }
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
}
