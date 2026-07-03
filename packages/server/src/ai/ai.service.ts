import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Question } from '../questions/question.schema';
import { LangchainClient } from './langchain-client';
import { getSystemPrompt } from './prompts';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly llm: LangchainClient,
    @InjectModel(Question.name) private questionModel: Model<Question>,
  ) {}

  async generateAnswer(questionId: string, mode: 'standard' | 'deep' = 'standard') {
    const question = await this.questionModel.findById(questionId).lean();
    if (!question) throw new NotFoundException('Question not found');

    this.logger.log(
      `generateAnswer id=${questionId} mode=${mode} category=${question.categorySlug} title="${question.title}"`,
    );

    const system = getSystemPrompt(question.categorySlug);
    const userPrompt =
      mode === 'deep'
        ? `请对以下面试题给出深入版参考答案，包含原理、示例、常见坑和追问应对：\n\n题目：${question.title}\n\n${question.content ? `补充说明：${question.content}` : ''}`
        : `请对以下面试题给出简洁但完整的参考答案（适合 3-5 分钟口述）：\n\n题目：${question.title}\n\n${question.content ? `补充说明：${question.content}` : ''}`;

    try {
      const aiAnswer = await this.llm.invoke(system, userPrompt);
      await this.questionModel.findByIdAndUpdate(questionId, { $set: { aiAnswer } });
      this.logger.log(`generateAnswer saved id=${questionId} answerLen=${aiAnswer.length}`);
      return { aiAnswer };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI request failed';
      this.logger.error(`generateAnswer failed id=${questionId}: ${message}`);
      if (message.includes('AI_API_KEY')) {
        throw new ServiceUnavailableException('AI_API_KEY is not configured');
      }
      throw new ServiceUnavailableException(message);
    }
  }
}
