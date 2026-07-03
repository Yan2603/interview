import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Question, QuestionSchema } from '../questions/question.schema';
import { Tag, TagSchema } from './tag.schema';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tag.name, schema: TagSchema },
      { name: Question.name, schema: QuestionSchema },
    ]),
  ],
  controllers: [TagsController],
  providers: [TagsService],
  exports: [TagsService, MongooseModule],
})
export class TagsModule {}
