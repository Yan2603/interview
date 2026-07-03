import { Logger, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AccessLogMiddleware } from './common/access-log.middleware';
import { CategoriesModule } from './categories/categories.module';
import { TagsModule } from './tags/tags.module';
import { QuestionsModule } from './questions/questions.module';
import { EventsModule } from './events/events.module';
import { AiModule } from './ai/ai.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SeedModule } from './seed/seed.module';

const isProd = process.env.NODE_ENV === 'production';

// monorepo 根目录 .env（pnpm --filter 时 cwd 在 packages/server）
const rootEnvPath = join(__dirname, '..', '..', '..', '.env');

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // 生产/Docker 只读 process.env，避免误加载 .env 里的 localhost / host.docker.internal
      ignoreEnvFile: isProd,
      envFilePath: isProd
        ? undefined
        : [rootEnvPath, join(process.cwd(), '.env'), join(process.cwd(), '..', '..', '.env')],
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const uri = config.get<string>('MONGODB_URI', 'mongodb://localhost:27017/interview');
        return {
          uri,
          connectionFactory: (connection: { on: (event: string, cb: () => void) => void }) => {
            connection.on('connected', () => {
              Logger.log('MongoDB connected', 'Mongoose');
            });
            connection.on('error', () => {
              Logger.error('MongoDB connection error', undefined, 'Mongoose');
            });
            return connection;
          },
        };
      },
      inject: [ConfigService],
    }),
    ...(isProd
      ? [
          ServeStaticModule.forRoot({
            rootPath: join(__dirname, '..', 'public'),
            exclude: ['/api*'],
            renderPath: '{*path}',
          }),
        ]
      : []),
    CategoriesModule,
    TagsModule,
    QuestionsModule,
    EventsModule,
    AiModule,
    DashboardModule,
    SeedModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AccessLogMiddleware).forRoutes('*');
  }
}
