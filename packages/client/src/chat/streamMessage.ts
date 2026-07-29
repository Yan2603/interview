import { refreshTokensRequest } from '../api/http';
import { runSingleFlightRefresh } from '../auth/refreshQueue';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from '../auth/tokenStorage';
import { parseSseChunk } from './sse';
import type { ChatSourceRef } from './types';

async function authorizedFetch(
  input: string,
  init: RequestInit,
  retried = false,
): Promise<Response> {
  const headers = new Headers(init.headers);
  const access = getAccessToken();
  if (access) headers.set('Authorization', `Bearer ${access}`);
  const response = await fetch(input, { ...init, headers });
  if (response.status !== 401 || retried) return response;
  const refresh = getRefreshToken();
  if (!refresh) {
    clearTokens();
    return response;
  }
  try {
    const tokens = await runSingleFlightRefresh(() => refreshTokensRequest(refresh));
    setTokens(tokens.accessToken, tokens.refreshToken);
    return authorizedFetch(input, init, true);
  } catch {
    clearTokens();
    return response;
  }
}

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
  const response = await authorizedFetch(`/api/chat/sessions/${sessionId}/messages`, {
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
