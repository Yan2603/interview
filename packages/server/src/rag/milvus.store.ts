import { Document } from '@langchain/core/documents';
import type { EmbeddingsInterface } from '@langchain/core/embeddings';
import { Milvus } from '@langchain/community/vectorstores/milvus';
import { ErrorCode, MilvusClient } from '@zilliz/milvus2-sdk-node';

export const RAG_COLLECTION_NAME = 'interview_rag';

/** LangChain sizes ALL metadata VarChar fields from the longest string in the first insert batch. */
export const METADATA_VARCHAR_MAX = 2048;

const BOOTSTRAP_SOURCE_ID = '__rag_schema_bootstrap__';

export interface MilvusStoreOptions {
  url: string;
  collectionName?: string;
}

/**
 * Connect to existing `interview_rag` collection, or return an unbound Milvus
 * instance when the collection is missing.
 *
 * Also repairs collections whose metadata VarChar max_length is too small
 * (LangChain derives it from the first insert — short titles freeze a tiny schema).
 */
export async function getOrCreateMilvusStore(
  embeddings: EmbeddingsInterface,
  options: MilvusStoreOptions,
): Promise<Milvus> {
  const collectionName = options.collectionName ?? RAG_COLLECTION_NAME;
  const opts = {
    collectionName,
    url: options.url,
    textFieldMaxLength: 65535,
  };

  await ensureMetadataSchemaCapacity(embeddings, options.url, collectionName);

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

/**
 * If collection exists with undersized VarChar metadata (e.g. title max=26), drop it.
 * If collection is missing, create it via a padded bootstrap document so all string
 * metadata fields get METADATA_VARCHAR_MAX.
 */
export async function ensureMetadataSchemaCapacity(
  embeddings: EmbeddingsInterface,
  url: string,
  collectionName: string = RAG_COLLECTION_NAME,
): Promise<void> {
  const client = new MilvusClient({ address: url });

  try {
    const hasColResp = await client.hasCollection({ collection_name: collectionName });
    if (hasColResp.status.error_code !== ErrorCode.SUCCESS) {
      throw new Error(`Error checking collection: ${JSON.stringify(hasColResp)}`);
    }

    if (hasColResp.value) {
      const maxLen = await getMinMetadataVarcharMaxLength(client, collectionName);
      if (maxLen > 0 && maxLen < METADATA_VARCHAR_MAX) {
        // Existing schema too small for real titles/filenames — recreate.
        const dropResp = await client.dropCollection({ collection_name: collectionName });
        if (dropResp.error_code !== ErrorCode.SUCCESS) {
          throw new Error(`Failed to drop undersized collection: ${JSON.stringify(dropResp)}`);
        }
      } else {
        return;
      }
    }

    await bootstrapCollectionWithPaddedMetadata(embeddings, url, collectionName);
  } finally {
    try {
      await client.closeConnection();
    } catch {
      // ignore close errors
    }
  }
}

function readFieldMaxLength(field: {
  name: string;
  type_params?: unknown;
  max_length?: string | number;
}): number {
  const params = field.type_params;
  if (Array.isArray(params)) {
    for (const pair of params) {
      const key = (pair as { key?: string }).key;
      const value = (pair as { value?: string }).value;
      if (key === 'max_length' && value !== undefined) {
        const n = parseInt(String(value), 10);
        return Number.isFinite(n) ? n : 0;
      }
    }
  } else if (params && typeof params === 'object' && 'max_length' in params) {
    const n = parseInt(String((params as { max_length: unknown }).max_length), 10);
    return Number.isFinite(n) ? n : 0;
  }
  if (field.max_length !== undefined) {
    const n = typeof field.max_length === 'number' ? field.max_length : parseInt(String(field.max_length), 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

async function getMinMetadataVarcharMaxLength(
  client: MilvusClient,
  collectionName: string,
): Promise<number> {
  const desc = await client.describeCollection({ collection_name: collectionName });
  // Prefer the `title` field — that is what fails with long question titles.
  // Fall back to the smallest metadata VarChar max_length present.
  const reserved = new Set(['pk', 'id', 'text', 'vector', 'langchain_primaryid']);
  let titleMax = 0;
  let minMeta = Number.POSITIVE_INFINITY;

  for (const field of desc.schema?.fields ?? []) {
    if (reserved.has(field.name) || field.is_primary_key) continue;
    const n = readFieldMaxLength(field as { name: string; type_params?: unknown; max_length?: string | number });
    if (n <= 0) continue;
    if (field.name === 'title') titleMax = n;
    minMeta = Math.min(minMeta, n);
  }

  if (titleMax > 0) return titleMax;
  return Number.isFinite(minMeta) ? minMeta : 0;
}

async function bootstrapCollectionWithPaddedMetadata(
  embeddings: EmbeddingsInterface,
  url: string,
  collectionName: string,
): Promise<void> {
  const pad = 'x'.repeat(METADATA_VARCHAR_MAX);
  const store = new Milvus(embeddings, {
    collectionName,
    url,
    textFieldMaxLength: 65535,
  });

  // One long string field forces LangChain to set max_length=2048 for ALL metadata VarChars.
  await store.addDocuments([
    new Document({
      pageContent: 'schema bootstrap',
      metadata: {
        sourceType: pad,
        sourceId: BOOTSTRAP_SOURCE_ID,
        title: 'bootstrap',
        categorySlug: 'bootstrap',
        chunkIndex: 0,
      },
    }),
  ]);

  const milvus = store as Milvus & {
    client: {
      loadCollectionSync: (req: { collection_name: string }) => Promise<{ error_code: string }>;
    };
  };
  const loadResp = await milvus.client.loadCollectionSync({
    collection_name: collectionName,
  });
  if (loadResp.error_code !== ErrorCode.SUCCESS) {
    throw new Error(`Failed to load bootstrap collection: ${JSON.stringify(loadResp)}`);
  }

  await store.delete({
    filter: `sourceId == "${escapeMilvusString(BOOTSTRAP_SOURCE_ID)}"`,
  });
}

export function buildSourceFilter(sourceType: string, sourceId: string): string {
  return `sourceType == "${escapeMilvusString(sourceType)}" && sourceId == "${escapeMilvusString(sourceId)}"`;
}

export function buildSourceTypeFilter(sourceType: string): string {
  return `sourceType == "${escapeMilvusString(sourceType)}"`;
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
