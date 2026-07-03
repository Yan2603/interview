import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { Mastery } from './question.schema';

@Controller('questions')
export class QuestionsController {
  constructor(private readonly service: QuestionsService) {}

  @Get()
  findAll(
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('mastery') mastery?: Mastery,
  ) {
    return this.service.findAll({ category, search, mastery });
  }

  @Get('tags')
  findTags() {
    return this.service.findDistinctTags();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(
    @Body()
    body: {
      title: string;
      categorySlug: string;
      content?: string;
      myNotes?: string;
      tags?: string[];
    },
  ) {
    return this.service.create(body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      title: string;
      categorySlug: string;
      content: string;
      myNotes: string;
      aiAnswer: string;
      mastery: Mastery;
      tags: string[];
    }>,
  ) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
