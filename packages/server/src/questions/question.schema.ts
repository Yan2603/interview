import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type Mastery = 'new' | 'reviewing' | 'mastered';

export type QuestionDocument = HydratedDocument<Question>;

@Schema({ timestamps: true })
export class Question {
  @Prop({ required: true })
  title!: string;

  @Prop({ required: true, index: true })
  categorySlug!: string;

  @Prop({ default: '' })
  content!: string;

  @Prop({ default: '' })
  myNotes!: string;

  @Prop({ default: '' })
  aiAnswer!: string;

  @Prop({ enum: ['new', 'reviewing', 'mastered'], default: 'new' })
  mastery!: Mastery;

  @Prop({ type: [String], default: [] })
  tags!: string[];
}

export const QuestionSchema = SchemaFactory.createForClass(Question);

// 创建文本索引以优化搜索性能
QuestionSchema.index({ title: 'text', content: 'text', tags: 'text' });
