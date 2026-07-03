import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category } from '../categories/category.schema';
import { Question } from '../questions/question.schema';
import { Tag } from '../tags/tag.schema';

const SEED_CATEGORIES = [
  { slug: 'vue3', name: 'Vue3', order: 1 },
  { slug: 'performance', name: '性能优化', order: 2 },
  { slug: 'browser', name: '浏览器原理', order: 3 },
  { slug: 'network', name: '网络', order: 4 },
  { slug: 'engineering', name: '工程化', order: 5 },
  { slug: 'typescript', name: 'TypeScript', order: 6 },
  { slug: 'project', name: '项目深挖', order: 7 },
];

const SEED_QUESTIONS = [
  {
    title: 'Vue3 响应式原理是什么？与 Vue2 有何区别？',
    categorySlug: 'vue3',
    content: '请从依赖收集、触发更新、Proxy vs defineProperty 等角度回答。',
    tags: ['响应式', 'Proxy'],
  },
  {
    title: 'Composition API 相比 Options API 有什么优势？',
    categorySlug: 'vue3',
    content: '结合逻辑复用、TypeScript 支持、代码组织说明。',
    tags: ['Composition API'],
  },
  {
    title: 'Vue3 编译优化有哪些？',
    categorySlug: 'vue3',
    content: '静态提升、PatchFlag、Block Tree 等。',
    tags: ['编译'],
  },
  {
    title: '首屏加载慢如何排查与优化？',
    categorySlug: 'performance',
    content: '从网络、资源体积、渲染路径、缓存策略等方面回答。',
    tags: ['首屏'],
  },
  {
    title: '长列表渲染如何优化？',
    categorySlug: 'performance',
    content: '虚拟列表、分页、requestAnimationFrame 等。',
    tags: ['虚拟列表'],
  },
  {
    title: '从输入 URL 到页面展示发生了什么？',
    categorySlug: 'browser',
    content: 'DNS、TCP、HTTP、解析、渲染树、布局、绘制等。',
    tags: ['渲染流程'],
  },
  {
    title: '浏览器缓存有哪些？优先级如何？',
    categorySlug: 'browser',
    content: '强缓存、协商缓存、Service Worker 等。',
    tags: ['缓存'],
  },
  {
    title: 'HTTP 与 HTTPS 的区别？',
    categorySlug: 'network',
    content: 'TLS 握手、证书、端口、安全性等。',
    tags: ['HTTP'],
  },
  {
    title: 'Vite 为什么比 Webpack 快？',
    categorySlug: 'engineering',
    content: '开发态 ESM、预构建、生产 Rollup 等。',
    tags: ['Vite'],
  },
  {
    title: 'interface 和 type 的区别？',
    categorySlug: 'typescript',
    content: '声明合并、联合类型、extends 等差异。',
    tags: ['类型'],
  },
  {
    title: '介绍一个你负责的核心项目',
    categorySlug: 'project',
    content: '用 STAR 法则组织，突出技术难点与个人贡献。',
    tags: ['STAR'],
  },
];

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectModel(Category.name) private categoryModel: Model<Category>,
    @InjectModel(Question.name) private questionModel: Model<Question>,
    @InjectModel(Tag.name) private tagModel: Model<Tag>,
  ) {}

  async onModuleInit() {
    const categoryCount = await this.categoryModel.countDocuments();
    if (categoryCount === 0) {
      await this.categoryModel.insertMany(SEED_CATEGORIES);
      await this.questionModel.insertMany(SEED_QUESTIONS);
      this.logger.log(
        `Initial seed created: ${SEED_CATEGORIES.length} categories, ${SEED_QUESTIONS.length} questions`,
      );
    }

    const tagCount = await this.tagModel.countDocuments();
    if (tagCount === 0) {
      const fromSeed = SEED_QUESTIONS.flatMap((q) => q.tags);
      const fromQuestions = await this.questionModel.distinct('tags');
      const names = [...new Set([...fromSeed, ...fromQuestions])].filter(Boolean);
      await this.tagModel.insertMany(
        names.map((name, index) => ({ name, order: index + 1 })),
      );
      this.logger.log(`Initial tags created: ${names.length} tags`);
    }
  }
}
