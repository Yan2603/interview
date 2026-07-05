import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  app.useLogger(logger);

  app.setGlobalPrefix('api');

  // CORS 配置
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 全局异常过滤器需要注入 logger
  app.useGlobalFilters(new AllExceptionsFilter(logger));

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  logger.log(`Server running on http://localhost:${port}`, 'Bootstrap');
  logger.log(`Environment: ${process.env.NODE_ENV ?? 'development'}`, 'Bootstrap');
  logger.log(`AI model: ${process.env.AI_MODEL ?? 'qwen-max'}`, 'Bootstrap');
  logger.log(`AI configured: ${process.env.AI_API_KEY ? 'yes' : 'no'}`, 'Bootstrap');
  logger.log(`CORS origins: ${allowedOrigins.join(', ')}`, 'Bootstrap');
}

bootstrap();
