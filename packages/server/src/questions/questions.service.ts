import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { sanitizeRichTextHtml } from '../common/sanitize-rich-text';
import { Mastery, Question } from './question.schema';

function sanitizeMyNotes(data: Partial<Question>): Partial<Question> {
  if (typeof data.myNotes !== 'string') return data;
  return { ...data, myNotes: sanitizeRichTextHtml(data.myNotes) };
}

export interface QuestionQuery {
  category?: string;
  search?: string;
  mastery?: Mastery;
  company?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedQuestions {
  items: Question[];
  total: number;
  page: number;
  pageSize: number;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class QuestionsService {
  constructor(@InjectModel(Question.name) private model: Model<Question>) {}

  async findAll(query: QuestionQuery): Promise<PaginatedQuestions> {
    const filter: FilterQuery<Question> = {};
    if (query.category) filter.categorySlug = query.category;
    if (query.mastery) filter.mastery = query.mastery;
    if (query.company) filter.companies = query.company;
    if (query.search) {
      const escaped = escapeRegex(query.search);
      filter.$or = [
        { title: { $regex: escaped, $options: 'i' } },
        { content: { $regex: escaped, $options: 'i' } },
        { tags: { $regex: escaped, $options: 'i' } },
        { companies: { $regex: escaped, $options: 'i' } },
      ];
    }

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      this.model.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(pageSize).lean(),
      this.model.countDocuments(filter),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(id: string) {
    const doc = await this.model.findById(id).lean();
    if (!doc) throw new NotFoundException('Question not found');
    return doc;
  }

  create(data: Partial<Question>) {
    return this.model.create(sanitizeMyNotes(data));
  }

  async update(id: string, data: Partial<Question>) {
    const doc = await this.model
      .findByIdAndUpdate(id, { $set: sanitizeMyNotes(data) }, { new: true })
      .lean();
    if (!doc) throw new NotFoundException('Question not found');
    return doc;
  }

  async remove(id: string) {
    const doc = await this.model.findByIdAndDelete(id).lean();
    if (!doc) throw new NotFoundException('Question not found');
    return { ok: true };
  }
}
