import { parseSseChunk } from './sse';
import type { ChatSourceRef } from './types';

function dispatchEvent(
  event: ReturnType<typeof parseSseChunk>['events'][number],
  handlers: {
    onToken: (t: string) => void;
    onSources: (s: ChatSourceRef[]) => void;
    onDone: () => void;
    onError: (msg: string) => void;
  },
) {
  switch (event.event) {
    case 'token':
      handlers.onToken(event.data);
      break;
    case 'sources':
      handlers.onSources(event.data);
      break;
    case 'done':
      handlers.onDone();
      break;
    case 'error':
      handlers.onError(event.data);
      break;
  }
}

export async function streamChatMessage(
  sessionId: string,
  content: string,
  handlers: {
    onToken: (t: string) => void;
    onSources: (s: ChatSourceRef[]) => void;
    onDone: () => void;
    onError: (msg: string) => void;
  },
): Promise<void> {
  const response = await fetch(`/api/chat/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    handlers.onError(`HTTP ${response.status}`);
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    handlers.onError('No response body');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSseChunk(buffer);
    buffer = parsed.rest;

    for (const event of parsed.events) {
      dispatchEvent(event, handlers);
    }
  }

  if (buffer.trim()) {
    const parsed = parseSseChunk(`${buffer}\n\n`);
    for (const event of parsed.events) {
      dispatchEvent(event, handlers);
    }
  }
}
