import type { ChatSourceRef } from './entities/chat-message.entity';

type Retrieved = {
  pageContent: string;
  metadata: Record<string, unknown>;
  score?: number;
};

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

export function docsToSources(docs: Retrieved[]): ChatSourceRef[] {
  const out: ChatSourceRef[] = [];
  const seen = new Set<string>();
  for (const doc of docs) {
    const sourceType = asString(doc.metadata.sourceType) as ChatSourceRef['sourceType'];
    const id = asString(doc.metadata.sourceId);
    if (sourceType !== 'question' && sourceType !== 'document') continue;
    if (!id) continue;
    const key = `${sourceType}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const snippet = doc.pageContent.length > 240
      ? `${doc.pageContent.slice(0, 240)}…`
      : doc.pageContent;
    out.push({
      sourceType,
      id,
      title: asString(doc.metadata.title, id),
      snippet,
      score: doc.score,
    });
  }
  return out;
}
