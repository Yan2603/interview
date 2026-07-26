import { describe, expect, it } from 'vitest';
import { docsToSources } from './citations';

describe('docsToSources', () => {
  it('maps question and document metadata', () => {
    const sources = docsToSources([
      {
        pageContent: 'chunk about vue',
        metadata: {
          sourceType: 'question',
          sourceId: 'q1',
          title: 'Vue 题',
          chunkIndex: 0,
        },
        score: 0.9,
      },
      {
        pageContent: 'from pdf',
        metadata: {
          sourceType: 'document',
          sourceId: 'd1',
          title: 'notes.pdf',
          chunkIndex: 2,
        },
      },
    ]);
    expect(sources).toEqual([
      {
        sourceType: 'question',
        id: 'q1',
        title: 'Vue 题',
        snippet: 'chunk about vue',
        score: 0.9,
      },
      {
        sourceType: 'document',
        id: 'd1',
        title: 'notes.pdf',
        snippet: 'from pdf',
        score: undefined,
      },
    ]);
  });

  it('dedupes by sourceType+id keeping first', () => {
    const sources = docsToSources([
      {
        pageContent: 'a',
        metadata: { sourceType: 'document', sourceId: 'd1', title: 'f', chunkIndex: 0 },
      },
      {
        pageContent: 'b',
        metadata: { sourceType: 'document', sourceId: 'd1', title: 'f', chunkIndex: 1 },
      },
    ]);
    expect(sources).toHaveLength(1);
    expect(sources[0].snippet).toBe('a');
  });
});
