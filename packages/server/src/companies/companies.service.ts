import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InterviewEvent } from '../events/event.schema';
import { Question } from '../questions/question.schema';
import { Company } from './company.schema';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectModel(Company.name) private model: Model<Company>,
    @InjectModel(Question.name) private questionModel: Model<Question>,
    @InjectModel(InterviewEvent.name) private eventModel: Model<InterviewEvent>,
  ) {}

  findAll() {
    return this.model.find().sort({ order: 1, name: 1 }).lean();
  }

  async assertExists(name: string) {
    const trimmed = name.trim();
    if (!trimmed) throw new ConflictException('公司名称不能为空');
    const exists = await this.model.findOne({ name: trimmed }).lean();
    if (!exists) throw new NotFoundException(`公司「${trimmed}」不存在，请先在公司注册表中创建`);
    return trimmed;
  }

  create(data: { name: string; order?: number }) {
    return this.model.create({
      name: data.name.trim(),
      order: data.order,
    });
  }

  async update(id: string, data: { name: string }) {
    const company = await this.model.findById(id).lean();
    if (!company) throw new NotFoundException('Company not found');

    const newName = data.name.trim();
    if (!newName) throw new ConflictException('公司名称不能为空');
    if (newName !== company.name) {
      const exists = await this.model.findOne({ name: newName, _id: { $ne: id } }).lean();
      if (exists) throw new ConflictException('公司名称已存在');

      await Promise.all([
        this.questionModel.updateMany(
          { companies: company.name },
          { $set: { 'companies.$[elem]': newName } },
          { arrayFilters: [{ elem: company.name }] },
        ),
        this.eventModel.updateMany(
          { company: company.name },
          { $set: { company: newName } },
        ),
      ]);
    }

    const doc = await this.model
      .findByIdAndUpdate(id, { $set: { name: newName } }, { new: true })
      .lean();
    if (!doc) throw new NotFoundException('Company not found');
    return doc;
  }

  async remove(id: string) {
    const company = await this.model.findById(id).lean();
    if (!company) throw new NotFoundException('Company not found');

    const [questionCount, eventCount] = await Promise.all([
      this.questionModel.countDocuments({ companies: company.name }),
      this.eventModel.countDocuments({ company: company.name }),
    ]);
    if (questionCount > 0 || eventCount > 0) {
      const parts: string[] = [];
      if (questionCount > 0) parts.push(`${questionCount} 道题目`);
      if (eventCount > 0) parts.push(`${eventCount} 场面试`);
      throw new ConflictException(`还有 ${parts.join('、')} 使用该公司，无法删除`);
    }

    await this.model.findByIdAndDelete(id);
    return { ok: true };
  }
}
