import { Document } from '@langchain/core/documents';
import type { EmbeddingsInterface } from '@langchain/core/embeddings';
import { Milvus } from '@langchain/community/vectorstores/milvus';

export const RAG_COLLECTION_NAME = 'interview_rag';

export interface MilvusStoreOptions {
  url: string;
  collectionName?: string;
}

/**
 * Connect to existing `interview_rag` collection, or return an unbound Milvus
 * instance when the collection is missing.
 *
 * Note: `Milvus.fromDocuments([])` does not create a collection (empty addVectors
 * is a no-op). Collection schema is created lazily on the first `addDocuments`.
 */
export async function getOrCreateMilvusStore(
  embeddings: EmbeddingsInterface,
  options: MilvusStoreOptions,
): Promise<Milvus> {
  const opts = {
    collectionName: options.collectionName ?? RAG_COLLECTION_NAME,
    url: options.url,
    textFieldMaxLength: 65535,
  };

  try {
    return await Milvus.fromExistingCollection(embeddings, opts);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/collection not found/i.test(message)) {
      throw err;
    }
    return new Milvus(embeddings, opts);
  }
}

export function buildSourceFilter(sourceType: string, sourceId: string): string {
  return `sourceType == "${escapeMilvusString(sourceType)}" && sourceId == "${escapeMilvusString(sourceId)}"`;
}

export function mapScoredDocuments(results: [Document, number][]): Document[] {
  return results.map(([doc, score]) => {
    return new Document({
      pageContent: doc.pageContent,
      metadata: {
        ...doc.metadata,
        score,
      },
    });
  });
}

function escapeMilvusString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
