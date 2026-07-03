import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category } from './category.schema';

@Injectable()
export class CategoriesService {
  constructor(@InjectModel(Category.name) private model: Model<Category>) {}

  findAll() {
    return this.model.find().sort({ order: 1 }).lean();
  }

  findBySlug(slug: string) {
    return this.model.findOne({ slug }).lean();
  }

  create(data: { slug: string; name: string; order?: number }) {
    return this.model.create(data);
  }
}
