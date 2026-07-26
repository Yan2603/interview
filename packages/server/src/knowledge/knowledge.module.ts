import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuestionsModule } from '../questions/questions.module';
import { RagModule } from '../rag/rag.module';
import { KnowledgeDocument } from './entities/knowledge-document.entity';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { QuestionIndexerService } from './question-indexer.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([KnowledgeDocument]),
    RagModule,
    forwardRef(() => QuestionsModule),
  ],
  controllers: [KnowledgeController],
  providers: [KnowledgeService, QuestionIndexerService],
  exports: [KnowledgeService, QuestionIndexerService],
})
export class KnowledgeModule {}
