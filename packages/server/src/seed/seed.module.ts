import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Category, CategorySchema } from '../categories/category.schema';
import { Company, CompanySchema } from '../companies/company.schema';
import { InterviewEvent, InterviewEventSchema } from '../events/event.schema';
import { Question, QuestionSchema } from '../questions/question.schema';
import { Tag, TagSchema } from '../tags/tag.schema';
import { SeedService } from './seed.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Category.name, schema: CategorySchema },
      { name: Question.name, schema: QuestionSchema },
      { name: Tag.name, schema: TagSchema },
      { name: Company.name, schema: CompanySchema },
      { name: InterviewEvent.name, schema: InterviewEventSchema },
    ]),
  ],
  providers: [SeedService],
})
export class SeedModule {}
