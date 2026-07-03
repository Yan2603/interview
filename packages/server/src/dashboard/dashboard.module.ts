import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Question, QuestionSchema } from '../questions/question.schema';
import { InterviewEvent, InterviewEventSchema } from '../events/event.schema';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Question.name, schema: QuestionSchema },
      { name: InterviewEvent.name, schema: InterviewEventSchema },
    ]),
  ],
  controllers: [DashboardController],
})
export class DashboardModule {}
