import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { RagModule } from '../rag/rag.module';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatSession } from './entities/chat-session.entity';
import { ChatController } from './chat.controller';
import { ChatRagService } from './chat-rag.service';
import { ChatService } from './chat.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatSession, ChatMessage]),
    RagModule,
    AiModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatRagService],
  exports: [ChatService],
})
export class ChatModule {}
