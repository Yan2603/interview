import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Question } from '../questions/question.schema';
import { Category } from './category.schema';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name) private model: Model<Category>,
    @InjectModel(Question.name) private questionModel: Model<Question>,
  ) {}

  findAll() {
    return this.model.find().sort({ order: 1 }).lean();
  }

  findBySlug(slug: string) {
    return this.model.findOne({ slug }).lean();
  }

  create(data: { slug: string; name: string; order?: number }) {
    return this.model.create(data);
  }

  async update(id: string, data: { name: string }) {
    const doc = await this.model
      .findByIdAndUpdate(id, { $set: { name: data.name } }, { new: true })
      .lean();
    if (!doc) throw new NotFoundException('Category not found');
    return doc;
  }

  async remove(id: string) {
    const category = await this.model.findById(id).lean();
    if (!category) throw new NotFoundException('Category not found');

    const questionCount = await this.questionModel.countDocuments({
      categorySlug: category.slug,
    });
    if (questionCount > 0) {
      throw new ConflictException(`该分类下还有 ${questionCount} 道题目，无法删除`);
    }

    await this.model.findByIdAndDelete(id);
    return { ok: true };
  }
}
