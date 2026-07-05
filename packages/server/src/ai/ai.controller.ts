import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AiService } from './ai.service';

@Controller()
export class AiController {
  constructor(private readonly service: AiService) {}

  @Get('questions/:id/ai-answer')
  @Post('questions/:id/ai-answer')
  @Throttle({ default: { limit: 10, ttl: 60000 } })  // 每分钟最多 10 次 AI 请求
  generate(
    @Param('id') id: string,
    @Query('mode') mode?: 'standard' | 'deep',
  ) {
    return this.service.generateAnswer(id, mode ?? 'standard');
  }
}
