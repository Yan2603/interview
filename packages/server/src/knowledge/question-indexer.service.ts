import { Document } from '@langchain/core/documents';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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

@Injectable()
export class QuestionIndexerService implements OnModuleInit {
  private readonly logger = new Logger(QuestionIndexerService.name);

  constructor(
    private readonly rag: RagService,
    private readonly questions: QuestionsService,
  ) {}

  onModuleInit(): void {
    void this.reindexAll().catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Startup reindexAll failed: ${message}`);
    });
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
}
