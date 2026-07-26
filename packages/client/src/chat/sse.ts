import type { ChatSourceRef, SseEvent } from './types';

export function parseSseChunk(buffer: string): { events: SseEvent[]; rest: string } {
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';
  const events: SseEvent[] = [];

  for (const part of parts) {
    if (!part.trim()) continue;

    let eventType = '';
    let data = '';

    for (const line of part.split('\n')) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7);
      } else if (line.startsWith('data: ')) {
        data = line.slice(6);
      }
    }

    if (!eventType) continue;

    switch (eventType) {
      case 'token':
        events.push({ event: 'token', data });
        break;
      case 'sources':
        events.push({ event: 'sources', data: JSON.parse(data) as ChatSourceRef[] });
        break;
      case 'done':
        events.push({ event: 'done', data: '' });
        break;
      case 'error':
        events.push({ event: 'error', data });
        break;
    }
  }

  return { events, rest };
}
