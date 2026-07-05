import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AiService } from './ai.service';

@Controller()
export class AiController {
  constructor(private readonly service: AiService) {}

  @Get('questions/:id/ai-answer')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  generateViaGet(
    @Param('id') id: string,
    @Query('mode') mode?: 'standard' | 'deep',
  ) {
    return this.generate(id, mode);
  }

  @Post('questions/:id/ai-answer')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  generateViaPost(
    @Param('id') id: string,
    @Query('mode') mode?: 'standard' | 'deep',
  ) {
    return this.generate(id, mode);
  }

  private generate(id: string, mode?: 'standard' | 'deep') {
    return this.service.generateAnswer(id, mode ?? 'standard');
  }
}
