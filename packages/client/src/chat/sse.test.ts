import { describe, expect, it } from 'vitest';
import { parseSseChunk } from './sse';

describe('parseSseChunk', () => {
  it('parses token events and keeps incomplete rest', () => {
    const { events, rest } = parseSseChunk(
      'event: token\ndata: 你\n\nevent: token\ndata: 好\n\nevent: sou',
    );
    expect(events).toEqual([
      { event: 'token', data: '你' },
      { event: 'token', data: '好' },
    ]);
    expect(rest).toBe('event: sou');
  });

  it('parses sources JSON', () => {
    const payload = JSON.stringify([
      { sourceType: 'question', id: '1', title: 't', snippet: 's' },
    ]);
    const { events } = parseSseChunk(`event: sources\ndata: ${payload}\n\n`);
    expect(events[0]).toEqual({
      event: 'sources',
      data: [{ sourceType: 'question', id: '1', title: 't', snippet: 's' }],
    });
  });
});
