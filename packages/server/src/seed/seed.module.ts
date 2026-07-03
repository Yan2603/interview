import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Category, CategorySchema } from '../categories/category.schema';
import { Question, QuestionSchema } from '../questions/question.schema';
import { Tag, TagSchema } from '../tags/tag.schema';
import { SeedService } from './seed.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Category.name, schema: CategorySchema },
      { name: Question.name, schema: QuestionSchema },
      { name: Tag.name, schema: TagSchema },
    ]),
  ],
  providers: [SeedService],
})
export class SeedModule {}
