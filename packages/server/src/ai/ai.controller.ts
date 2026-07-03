import { Controller, Param, Post, Query } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller()
export class AiController {
  constructor(private readonly service: AiService) {}

  @Post('questions/:id/ai-answer')
  generate(
    @Param('id') id: string,
    @Query('mode') mode?: 'standard' | 'deep',
  ) {
    return this.service.generateAnswer(id, mode ?? 'standard');
  }
}
