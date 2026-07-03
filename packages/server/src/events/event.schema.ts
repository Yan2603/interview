import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type EventStatus = 'scheduled' | 'completed' | 'cancelled';

export type InterviewEventDocument = HydratedDocument<InterviewEvent>;

@Schema({ timestamps: true })
export class InterviewEvent {
  @Prop({ required: true })
  company!: string;

  @Prop({ default: '一面' })
  round!: string;

  @Prop({ required: true, index: true })
  start!: Date;

  @Prop()
  end?: Date;

  @Prop({ default: '' })
  link!: string;

  @Prop({ default: '' })
  notes!: string;

  @Prop({ enum: ['scheduled', 'completed', 'cancelled'], default: 'scheduled' })
  status!: EventStatus;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Question' }], default: [] })
  relatedQuestionIds!: Types.ObjectId[];
}

export const InterviewEventSchema = SchemaFactory.createForClass(InterviewEvent);
