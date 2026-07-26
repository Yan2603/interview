import { Document } from '@langchain/core/documents';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QuestionsService } from '../questions/questions.service';
import { RagService } from '../rag/rag.service';
import { buildQuestionIndexText } from './question-text';

export type IndexableQuestion = {
  _id: { toString(): string } | string;
  title: string;
  content?: string;
  myNotes?: string;
  aiAnswer?: string;
  categorySlug?: string;
};

/** Optional delayed startup reindex; default off — use knowledge management page / POST reindex. */
const STARTUP_REINDEX_DELAY_MS = 3000;

@Injectable()
export class QuestionIndexerService implements OnModuleInit {
  private readonly logger = new Logger(QuestionIndexerService.name);

  constructor(
    private readonly rag: RagService,
    private readonly questions: QuestionsService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const enabled = this.config.get<string>('RAG_STARTUP_REINDEX', 'false') === 'true';
    if (!enabled) {
      this.logger.log(
        'Startup reindexAll skipped (default). Use 知识库管理页 or POST /api/knowledge/reindex/questions',
      );
      return;
    }

    setTimeout(() => {
      void this.reindexAll().catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Startup reindexAll failed: ${message}`);
      });
    }, STARTUP_REINDEX_DELAY_MS);
  }

  async upsert(question: IndexableQuestion): Promise<void> {
    const sourceId = String(question._id);
    await this.rag.deleteBySource('question', sourceId);

    const text = buildQuestionIndexText(question);
    if (!text.trim()) {
      return;
    }

    const doc = new Document({
      pageContent: text,
      metadata: {
        sourceType: 'question',
        sourceId,
        title: question.title,
        categorySlug: question.categorySlug ?? '',
      },
    });

    const chunks = await this.rag.splitDocuments([doc]);
    chunks.forEach((chunk, chunkIndex) => {
      chunk.metadata = {
        ...chunk.metadata,
        sourceType: 'question',
        sourceId,
        title: question.title,
        categorySlug: question.categorySlug ?? '',
        chunkIndex,
      };
    });

    await this.rag.addDocuments(chunks);
  }

  async remove(questionId: string): Promise<void> {
    await this.rag.deleteBySource('question', questionId);
  }

  async reindexAll(): Promise<{ indexed: number; total: number }> {
    const questions = await this.questions.findAllForIndex();

    // Wipe all question vectors first so orphans (Mongo-deleted / failed deletes) are cleared.
    try {
      await this.rag.deleteBySourceType('question');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`deleteBySourceType(question) failed: ${message}`);
      throw err;
    }

    let indexed = 0;
    for (const q of questions) {
      try {
        await this.upsert(q);
        indexed += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`upsert failed id=${String(q._id)}: ${message}`);
      }
    }

    this.logger.log(`reindexAll complete indexed=${indexed}/${questions.length}`);
    return { indexed, total: questions.length };
  }

  /** Mongo 题目 ↔ Milvus chunk 对照，供管理页展示。 */
  async getIndexStatus(): Promise<QuestionIndexStatusResponse> {
    const questions = await this.questions.findAllForIndex();
    let chunks: Awaited<ReturnType<RagService['listChunksBySourceType']>> = [];
    try {
      chunks = await this.rag.listChunksBySourceType('question');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`listChunksBySourceType failed: ${message}`);
      throw err;
    }

    const bySource = new Map<string, QuestionIndexChunk[]>();
    for (const c of chunks) {
      if (!c.sourceId) continue;
      const list = bySource.get(c.sourceId) ?? [];
      list.push({
        chunkIndex: c.chunkIndex,
        text: c.text,
        title: c.title,
      });
      bySource.set(c.sourceId, list);
    }
    for (const list of bySource.values()) {
      list.sort((a, b) => a.chunkIndex - b.chunkIndex);
    }

    const mongoIds = new Set(questions.map((q) => String(q._id)));
    const items: QuestionIndexStatusItem[] = questions.map((q) => {
      const id = String(q._id);
      const qChunks = bySource.get(id) ?? [];
      return {
        questionId: id,
        title: q.title,
        categorySlug: q.categorySlug ?? '',
        indexed: qChunks.length > 0,
        chunkCount: qChunks.length,
        chunks: qChunks,
        orphan: false,
      };
    });

    for (const [sourceId, qChunks] of bySource) {
      if (mongoIds.has(sourceId)) continue;
      items.push({
        questionId: sourceId,
        title: qChunks[0]?.title || sourceId,
        categorySlug: '',
        indexed: true,
        chunkCount: qChunks.length,
        chunks: qChunks,
        orphan: true,
      });
    }

    items.sort((a, b) => {
      if (a.orphan !== b.orphan) return a.orphan ? 1 : -1;
      if (a.indexed !== b.indexed) return a.indexed ? -1 : 1;
      return a.title.localeCompare(b.title, 'zh-CN');
    });

    const indexedCount = items.filter((i) => i.indexed && !i.orphan).length;
    const orphanCount = items.filter((i) => i.orphan).length;

    return {
      summary: {
        totalQuestions: questions.length,
        indexed: indexedCount,
        notIndexed: questions.length - indexedCount,
        orphanSources: orphanCount,
        totalChunks: chunks.length,
      },
      items,
    };
  }
}

export type QuestionIndexChunk = {
  chunkIndex: number;
  text: string;
  title?: string;
};

export type QuestionIndexStatusItem = {
  questionId: string;
  title: string;
  categorySlug: string;
  indexed: boolean;
  chunkCount: number;
  chunks: QuestionIndexChunk[];
  orphan: boolean;
};

export type QuestionIndexStatusResponse = {
  summary: {
    totalQuestions: number;
    indexed: number;
    notIndexed: number;
    orphanSources: number;
    totalChunks: number;
  };
  items: QuestionIndexStatusItem[];
};
