import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ChatSession } from './chat-session.entity';

export type ChatRole = 'user' | 'assistant';

export type ChatSourceRef = {
  sourceType: 'question' | 'document';
  id: string;
  title: string;
  snippet: string;
  score?: number;
};

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  sessionId!: string;

  @ManyToOne(() => ChatSession, (s) => s.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sessionId' })
  session!: ChatSession;

  @Column({ type: 'varchar' })
  role!: ChatRole;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'jsonb', nullable: true })
  sources!: ChatSourceRef[] | null;

  @CreateDateColumn()
  createdAt!: Date;
}
