import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InterviewEvent, InterviewEventSchema } from '../events/event.schema';
import { Question, QuestionSchema } from '../questions/question.schema';
import { Company, CompanySchema } from './company.schema';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Company.name, schema: CompanySchema },
      { name: Question.name, schema: QuestionSchema },
      { name: InterviewEvent.name, schema: InterviewEventSchema },
    ]),
  ],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService, MongooseModule],
})
export class CompaniesModule {}
