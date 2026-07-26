import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { ChatRagService } from './chat-rag.service';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('chat/sessions')
export class ChatController {
  constructor(
    private readonly service: ChatService,
    private readonly chatRag: ChatRagService,
  ) {}

  @Get()
  list() {
    return this.service.listSessions();
  }

  @Post()
  create(@Body() body: { title?: string }) {
    return this.service.createSession(body?.title);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getSession(id);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteSession(id);
  }

  @Post(':id/messages')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  sendMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
    @Res() res: Response,
  ) {
    return this.chatRag.streamAnswer(id, dto.content, res);
  }
}
