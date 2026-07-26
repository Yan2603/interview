import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessage, ChatRole, ChatSourceRef } from './entities/chat-message.entity';
import { ChatSession } from './entities/chat-session.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatSession)
    private readonly sessionRepo: Repository<ChatSession>,
    @InjectRepository(ChatMessage)
    private readonly messageRepo: Repository<ChatMessage>,
  ) {}

  async createSession(title?: string): Promise<ChatSession> {
    const session = this.sessionRepo.create({
      title: title?.trim() || '新对话',
    });
    return this.sessionRepo.save(session);
  }

  listSessions(): Promise<ChatSession[]> {
    return this.sessionRepo.find({ order: { updatedAt: 'DESC' } });
  }

  async getSession(id: string): Promise<ChatSession> {
    const session = await this.sessionRepo.findOne({
      where: { id },
      relations: { messages: true },
      order: { messages: { createdAt: 'ASC' } },
    });
    if (!session) throw new NotFoundException('Chat session not found');
    return session;
  }

  async deleteSession(id: string): Promise<{ ok: true }> {
    const result = await this.sessionRepo.delete(id);
    if (!result.affected) throw new NotFoundException('Chat session not found');
    return { ok: true };
  }

  async appendMessage(
    sessionId: string,
    data: { role: ChatRole; content: string; sources?: ChatSourceRef[] | null },
  ): Promise<ChatMessage> {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Chat session not found');

    const message = this.messageRepo.create({
      sessionId,
      role: data.role,
      content: data.content,
      sources: data.sources ?? null,
    });
    const saved = await this.messageRepo.save(message);
    await this.sessionRepo.save(session);
    return saved;
  }

  async listRecentMessages(sessionId: string, limit = 10): Promise<ChatMessage[]> {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Chat session not found');

    const messages = await this.messageRepo.find({
      where: { sessionId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return messages.reverse();
  }
}
