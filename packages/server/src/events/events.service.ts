import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InterviewEvent } from './event.schema';

@Injectable()
export class EventsService {
  constructor(@InjectModel(InterviewEvent.name) private model: Model<InterviewEvent>) {}

  findInRange(from?: string, to?: string) {
    const filter: Record<string, unknown> = {};
    if (from || to) {
      filter.start = {};
      if (from) (filter.start as Record<string, Date>).$gte = new Date(from);
      if (to) (filter.start as Record<string, Date>).$lte = new Date(to);
    }
    return this.model.find(filter).sort({ start: 1 }).lean();
  }

  async findOne(id: string) {
    const doc = await this.model.findById(id).lean();
    if (!doc) throw new NotFoundException('Event not found');
    return doc;
  }

  create(data: {
    company: string;
    round?: string;
    start: Date;
    end?: Date;
    link?: string;
    notes?: string;
    status?: InterviewEvent['status'];
    relatedQuestionIds?: string[];
  }) {
    return this.model.create(data);
  }

  async update(id: string, data: Record<string, unknown>) {
    const doc = await this.model
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .lean();
    if (!doc) throw new NotFoundException('Event not found');
    return doc;
  }

  async remove(id: string) {
    const doc = await this.model.findByIdAndDelete(id).lean();
    if (!doc) throw new NotFoundException('Event not found');
    return { ok: true };
  }
}
