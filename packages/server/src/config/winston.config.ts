import { WinstonModule, utilities as nestWinstonModuleUtilities } from 'nest-winston';
import * as winston from 'winston';
import { join } from 'path';

const isProd = process.env.NODE_ENV === 'production';

// 日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
);

// 开发环境格式（带颜色）
const devFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.ms(),
  nestWinstonModuleUtilities.format.nestLike('Interview', {
    colors: true,
    prettyPrint: true,
  }),
);

// 日志目录
const logsDir = join(process.cwd(), 'logs');

// 传输配置
const transports: winston.transport[] = [
  // 控制台输出
  new winston.transports.Console({
    format: isProd ? logFormat : devFormat,
  }),
];

// 生产环境添加文件日志
if (isProd) {
  transports.push(
    // 所有日志
    new winston.transports.File({
      filename: join(logsDir, 'combined.log'),
      format: logFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 7,
    }),
    // 错误日志
    new winston.transports.File({
      filename: join(logsDir, 'error.log'),
      level: 'error',
      format: logFormat,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 14,
    }),
  );
}

export const winstonConfig = {
  level: isProd ? 'info' : 'debug',
  format: logFormat,
  transports,
  exceptionHandlers: isProd
    ? [
        new winston.transports.File({
          filename: join(logsDir, 'exceptions.log'),
        }),
      ]
    : undefined,
  rejectionHandlers: isProd
    ? [
        new winston.transports.File({
          filename: join(logsDir, 'rejections.log'),
        }),
      ]
    : undefined,
};

