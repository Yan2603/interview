import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { sanitizeRichTextHtml } from '../common/sanitize-rich-text';
import { CompaniesService } from '../companies/companies.service';
import { InterviewEvent, InterviewType } from './event.schema';

function sanitizeNotes(data: Record<string, unknown>) {
  if (typeof data.notes !== 'string') return data;
  return { ...data, notes: sanitizeRichTextHtml(data.notes) };
}

@Injectable()
export class EventsService {
  constructor(
    @InjectModel(InterviewEvent.name) private model: Model<InterviewEvent>,
    private readonly companiesService: CompaniesService,
  ) {}

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

  async create(data: {
    company: string;
    round?: string;
    start: Date;
    end?: Date;
    link?: string;
    interviewType?: InterviewType;
    location?: string;
    notes?: string;
    status?: InterviewEvent['status'];
    result?: InterviewEvent['result'];
    relatedQuestionIds?: string[];
  }) {
    const company = await this.companiesService.assertExists(data.company);
    return this.model.create(sanitizeNotes({ ...data, company }));
  }

  async update(id: string, data: Record<string, unknown>) {
    const payload = { ...data };
    if (typeof payload.company === 'string') {
      payload.company = await this.companiesService.assertExists(payload.company);
    }
    const doc = await this.model
      .findByIdAndUpdate(id, { $set: sanitizeNotes(payload) }, { new: true })
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
