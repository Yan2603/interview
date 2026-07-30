import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { QuestionIndexerService } from '../knowledge/question-indexer.service';
import { QuestionsService } from './questions.service';
import { Mastery } from './question.schema';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';

@Controller('questions')
export class QuestionsController {
  private readonly logger = new Logger(QuestionsController.name);

  constructor(
    private readonly service: QuestionsService,
    private readonly indexer: QuestionIndexerService,
  ) {}

  @Get()
  findAll(
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('mastery') mastery?: Mastery,
    @Query('company') company?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.findAll({
      category,
      search,
      mastery,
      company,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateQuestionDto) {
    const q = await this.service.create(dto);
    // 同步索引会阻塞保存（embedding + Milvus）；改由知识库管理页手工重建
    // await this.safeUpsert(q);
    return q;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateQuestionDto) {
    const q = await this.service.update(id, dto);
    // 同步索引会阻塞保存（embedding + Milvus）；改由知识库管理页手工重建
    // await this.safeUpsert(q);
    return q;
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const result = await this.service.remove(id);
    await this.safeRemove(id);
    return result;
  }

  private async safeUpsert(question: {
    _id: { toString(): string } | string;
    title: string;
    content?: string;
    myNotes?: string;
    aiAnswer?: string;
    categorySlug?: string;
  }): Promise<void> {
    try {
      await this.indexer.upsert(question);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`question index upsert failed id=${String(question._id)}: ${message}`);
    }
  }

  private async safeRemove(questionId: string): Promise<void> {
    try {
      await this.indexer.remove(questionId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`question index remove failed id=${questionId}: ${message}`);
    }
  }
}
