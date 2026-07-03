import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Question } from '../questions/question.schema';
import { Tag } from './tag.schema';

@Injectable()
export class TagsService {
  constructor(
    @InjectModel(Tag.name) private model: Model<Tag>,
    @InjectModel(Question.name) private questionModel: Model<Question>,
  ) {}

  findAll() {
    return this.model.find().sort({ order: 1, name: 1 }).lean();
  }

  create(data: { name: string; order?: number }) {
    return this.model.create(data);
  }

  async update(id: string, data: { name: string }) {
    const tag = await this.model.findById(id).lean();
    if (!tag) throw new NotFoundException('Tag not found');

    const newName = data.name.trim();
    if (!newName) throw new ConflictException('标签名称不能为空');
    if (newName !== tag.name) {
      const exists = await this.model.findOne({ name: newName, _id: { $ne: id } }).lean();
      if (exists) throw new ConflictException('标签名称已存在');

      await this.questionModel.updateMany(
        { tags: tag.name },
        { $set: { 'tags.$[elem]': newName } },
        { arrayFilters: [{ elem: tag.name }] },
      );
    }

    const doc = await this.model
      .findByIdAndUpdate(id, { $set: { name: newName } }, { new: true })
      .lean();
    if (!doc) throw new NotFoundException('Tag not found');
    return doc;
  }

  async remove(id: string) {
    const tag = await this.model.findById(id).lean();
    if (!tag) throw new NotFoundException('Tag not found');

    const questionCount = await this.questionModel.countDocuments({ tags: tag.name });
    if (questionCount > 0) {
      throw new ConflictException(`还有 ${questionCount} 道题目使用该标签，无法删除`);
    }

    await this.model.findByIdAndDelete(id);
    return { ok: true };
  }
}
