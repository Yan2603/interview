import { Logger, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { WinstonModule } from 'nest-winston';
import { join } from 'path';
import { AccessLogMiddleware } from './common/access-log.middleware';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { CategoriesModule } from './categories/categories.module';
import { TagsModule } from './tags/tags.module';
import { CompaniesModule } from './companies/companies.module';
import { QuestionsModule } from './questions/questions.module';
import { EventsModule } from './events/events.module';
import { AiModule } from './ai/ai.module';
import { RagModule } from './rag/rag.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SeedModule } from './seed/seed.module';
import { HealthModule } from './health/health.module';
import { UploadsModule } from './uploads/uploads.module';
import { resolveUploadRoot } from './uploads/upload-path';
import { winstonConfig } from './config/winston.config';
import { DatabaseModule } from './database/database.module';
import { ChatModule } from './chat/chat.module';
import { MilvusBrowserModule } from './milvus-browser/milvus-browser.module';

const isProd = process.env.NODE_ENV === 'production';
// monorepo 根目录 .env（dev 时 cwd 在 packages/server，不能只用 process.cwd()）
const rootEnvPath = join(__dirname, '..', '..', '..', '.env');

@Module({
  imports: [
    WinstonModule.forRoot(winstonConfig),
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: isProd,
      envFilePath: isProd ? undefined : [rootEnvPath, join(process.cwd(), '.env')],
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
    DatabaseModule,
    ThrottlerModule.forRoot([{
      ttl: 60000,    // 60 秒
      limit: 100,    // 最多 100 次请求
    }]),
    ServeStaticModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => [
        {
          rootPath: resolveUploadRoot(config.get<string>('UPLOAD_DIR')),
          serveRoot: '/uploads',
          serveStaticOptions: {
            index: false,
            fallthrough: false,
          },
        },
      ],
      inject: [ConfigService],
    }),
    ...(isProd
      ? [
          ServeStaticModule.forRoot({
            rootPath: join(__dirname, '..', 'public'),
            exclude: ['/api*', '/uploads*'],
            renderPath: '{*path}',
          }),
        ]
      : []),
    HealthModule,
    AuthModule,
    CategoriesModule,
    TagsModule,
    CompaniesModule,
    QuestionsModule,
    EventsModule,
    AiModule,
    RagModule,
    KnowledgeModule,
    ChatModule,
    MilvusBrowserModule,
    DashboardModule,
    SeedModule,
    UploadsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AccessLogMiddleware).forRoutes('*');
  }
}
