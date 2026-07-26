export type ChatSourceRef = {
  sourceType: 'question' | 'document';
  id: string;
  title: string;
  snippet: string;
  score?: number;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: ChatSourceRef[] | null;
  createdAt: string;
};

export type ChatSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages?: ChatMessage[];
};

export type KnowledgeDocument = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: string;
  status: 'pending' | 'ready' | 'failed';
  errorMessage?: string | null;
  chunkCount: number;
  createdAt: string;
};

export type SseEvent =
  | { event: 'token'; data: string }
  | { event: 'sources'; data: ChatSourceRef[] }
  | { event: 'done'; data: '' }
  | { event: 'error'; data: string };
