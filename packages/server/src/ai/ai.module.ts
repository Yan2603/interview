import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Question, QuestionSchema } from '../questions/question.schema';
import { LangchainClient } from './langchain-client';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: Question.name, schema: QuestionSchema }])],
  controllers: [AiController],
  providers: [LangchainClient, AiService],
  exports: [LangchainClient, AiService],
})
export class AiModule {}
