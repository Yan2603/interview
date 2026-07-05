import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { Mastery, Question } from './question.schema';

export interface QuestionQuery {
  category?: string;
  search?: string;
  mastery?: Mastery;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class QuestionsService {
  constructor(@InjectModel(Question.name) private model: Model<Question>) {}

  findAll(query: QuestionQuery) {
    const filter: FilterQuery<Question> = {};
    if (query.category) filter.categorySlug = query.category;
    if (query.mastery) filter.mastery = query.mastery;
    if (query.search) {
      const escaped = escapeRegex(query.search);
      filter.$or = [
        { title: { $regex: escaped, $options: 'i' } },
        { content: { $regex: escaped, $options: 'i' } },
        { tags: { $regex: escaped, $options: 'i' } },
      ];
    }
    return this.model.find(filter).sort({ updatedAt: -1 }).lean();
  }

  async findOne(id: string) {
    const doc = await this.model.findById(id).lean();
    if (!doc) throw new NotFoundException('Question not found');
    return doc;
  }

  create(data: Partial<Question>) {
    return this.model.create(data);
  }

  async update(id: string, data: Partial<Question>) {
    const doc = await this.model
      .findByIdAndUpdate(id, { $set: data }, { new: true })
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
