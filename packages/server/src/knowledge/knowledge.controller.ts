import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { extname } from 'path';
import {
  KnowledgeService,
  UploadedKnowledgeFile,
} from './knowledge.service';
import { QuestionIndexerService } from './question-indexer.service';

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXT = new Set(['.md', '.txt', '.pdf', '.docx']);

@Controller('knowledge')
export class KnowledgeController {
  constructor(
    private readonly service: KnowledgeService,
    private readonly questionIndexer: QuestionIndexerService,
  ) {}

  @Post('documents')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_SIZE },
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname || '').toLowerCase();
        if (!ALLOWED_EXT.has(ext)) {
          cb(
            new BadRequestException('仅支持 .md / .txt / .pdf / .docx') as unknown as Error,
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  upload(@UploadedFile() file: UploadedKnowledgeFile) {
    if (!file) {
      throw new BadRequestException('请选择文件（字段名 file）');
    }
    return this.service.uploadDocument(file);
  }

  @Get('documents')
  list() {
    return this.service.listDocuments();
  }

  @Delete('documents/:id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.service.removeDocument(id);
  }

  @Get('questions/index-status')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  questionIndexStatus() {
    return this.questionIndexer.getIndexStatus();
  }

  @Post('reindex/questions')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  reindexQuestions() {
    return this.questionIndexer.reindexAll();
  }
}
