import { Inject, Injectable, LoggerService, NestMiddleware } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class AccessLogMiddleware implements NestMiddleware {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const { method, originalUrl, ip } = req;

    res.on('finish', () => {
      const ms = Date.now() - start;
      const { statusCode } = res;
      const message = `${method} ${originalUrl}`;

      const logData = {
        method,
        url: originalUrl,
        statusCode,
        responseTime: `${ms}ms`,
        ip: ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent') || '',
      };

      if (statusCode >= 500) {
        this.logger.error(`${message} ${statusCode} ${ms}ms`, JSON.stringify(logData), 'HTTP');
      } else if (statusCode >= 400) {
        this.logger.warn(`${message} ${statusCode} ${ms}ms`, 'HTTP');
      } else {
        this.logger.log(`${message} ${statusCode} ${ms}ms`, 'HTTP');
      }
    });

    next();
  }
}
