import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import type { Response } from 'express';
import { LangchainClient } from '../ai/langchain-client';
import { RagService } from '../rag/rag.service';
import { ChatService } from './chat.service';
import { docsToSources } from './citations';
import type { ChatSourceRef } from './entities/chat-message.entity';

@Injectable()
export class ChatRagService {
  private readonly logger = new Logger(ChatRagService.name);

  constructor(
    private readonly chat: ChatService,
    private readonly rag: RagService,
    private readonly llm: LangchainClient,
  ) {}

  async streamAnswer(sessionId: string, content: string, res: Response): Promise<void> {
    // Validate session before starting SSE
    await this.chat.getSession(sessionId);

    let headersSent = false;
    const send = (event: string, data: string) => {
      if (!headersSent) {
        res.status(200);
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        headersSent = true;
      }
      res.write(`event: ${event}\ndata: ${data}\n\n`);
      if (typeof (res as Response & { flush?: () => void }).flush === 'function') {
        (res as Response & { flush: () => void }).flush();
      }
    };

    let fullText = '';
    let sources: ChatSourceRef[] = [];
    let tokensStarted = false;

    try {
      await this.chat.appendMessage(sessionId, { role: 'user', content });
      const recent = await this.chat.listRecentMessages(sessionId, 10);

      let retrieved;
      try {
        retrieved = await this.rag.retrieve(content, 6);
      } catch (err) {
        if (err instanceof ServiceUnavailableException) {
          throw err;
        }
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`RAG retrieve failed: ${message}`);
        if (message.includes('AI_API_KEY')) {
          throw new ServiceUnavailableException('AI_API_KEY is not configured');
        }
        throw new ServiceUnavailableException('知识库检索暂时不可用');
      }

      sources = docsToSources(
        retrieved.map((doc) => ({
          pageContent: doc.pageContent,
          metadata: doc.metadata as Record<string, unknown>,
          score:
            typeof doc.metadata?.score === 'number'
              ? (doc.metadata.score as number)
              : undefined,
        })),
      );

      const system = this.buildSystemPrompt(retrieved.map((d) => d.pageContent), sources);
      const messages = recent.map((m) => ({
        role: (m.role === 'user' ? 'human' : 'assistant') as 'human' | 'assistant',
        content: m.content,
      }));

      for await (const token of this.llm.stream(system, messages)) {
        tokensStarted = true;
        fullText += token;
        send('token', token);
      }

      send('sources', JSON.stringify(sources));

      await this.chat.appendMessage(sessionId, {
        role: 'assistant',
        content: fullText,
        sources,
      });

      send('done', '');
      res.end();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`streamAnswer failed session=${sessionId}: ${message}`);

      if (!headersSent) {
        if (err instanceof ServiceUnavailableException) {
          throw err;
        }
        if (message.includes('AI_API_KEY')) {
          throw new ServiceUnavailableException('AI_API_KEY is not configured');
        }
        throw err;
      }

      // Mid-stream failure: persist partial content / failure marker (design acceptance).
      if (tokensStarted || fullText.length > 0) {
        const failedContent = fullText
          ? `${fullText}\n\n[生成中断：${message}]`
          : `[生成失败：${message}]`;
        try {
          await this.chat.appendMessage(sessionId, {
            role: 'assistant',
            content: failedContent,
            sources: sources.length > 0 ? sources : undefined,
          });
        } catch (persistErr) {
          const persistMsg =
            persistErr instanceof Error ? persistErr.message : String(persistErr);
          this.logger.error(
            `Failed to persist partial assistant message session=${sessionId}: ${persistMsg}`,
          );
        }
      }

      send('error', message);
      res.end();
    }
  }

  private buildSystemPrompt(chunks: string[], sources: ChatSourceRef[]): string {
    const hit = sources.length > 0;
    const context =
      chunks.length === 0
        ? '（本次检索未命中任何知识库片段）'
        : chunks.map((c, i) => `[${i + 1}] ${c}`).join('\n\n');

    return [
      '你是面试备战助手。请仅依据下方检索到的知识库片段与对话历史回答用户问题。',
      hit
        ? '请优先引用检索内容作答，条理清晰，使用中文。'
        : '本次未命中知识库：你仍可作一般性回答，但必须明确声明「未命中知识库」。',
      '',
      '知识库检索结果：',
      context,
    ].join('\n');
  }
}
