import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat/sessions')
export class ChatController {
  constructor(private readonly service: ChatService) {}

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
}
