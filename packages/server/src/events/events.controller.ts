import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { EventStatus, InterviewResult, InterviewType } from './event.schema';

@Controller('events')
export class EventsController {
  constructor(private readonly service: EventsService) {}

  @Get()
  findAll(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.findInRange(from, to);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(
    @Body()
    body: {
      company: string;
      round?: string;
      start: string;
      end?: string;
      link?: string;
      interviewType?: InterviewType;
      location?: string;
      notes?: string;
      status?: EventStatus;
      result?: InterviewResult;
      relatedQuestionIds?: string[];
    },
  ) {
    return this.service.create({
      ...body,
      start: new Date(body.start),
      end: body.end ? new Date(body.end) : undefined,
    });
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      company: string;
      round: string;
      start: string;
      end: string;
      link: string;
      interviewType: InterviewType;
      location: string;
      notes: string;
      status: EventStatus;
      result: InterviewResult;
      relatedQuestionIds: string[];
    }>,
  ) {
    const data: Record<string, unknown> = { ...body };
    if (body.start) data.start = new Date(body.start);
    if (body.end) data.end = new Date(body.end);
    return this.service.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
