import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { MilvusBrowserService } from './milvus-browser.service';
import { clampEntityLimit } from './vector-display';

@Controller('milvus-browser')
export class MilvusBrowserController {
  constructor(private readonly service: MilvusBrowserService) {}

  @Get('collections')
  listCollections() {
    return this.service.listCollections();
  }

  @Get('collections/:name/schema')
  schema(@Param('name') name: string) {
    return this.service.getSchema(name);
  }

  @Get('collections/:name/entities')
  entities(
    @Param('name') name: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('fullVector') fullVector?: string,
  ) {
    return this.service.listEntities(name, {
      limit: clampEntityLimit(limit),
      offset: Math.max(0, Number.parseInt(offset ?? '0', 10) || 0),
      fullVector: fullVector === '1' || fullVector === 'true',
    });
  }

  @Post('collections/:name/query')
  @HttpCode(200)
  query(
    @Param('name') name: string,
    @Body() body: { expr?: string; outputFields?: string[]; limit?: number },
  ) {
    return this.service.query(name, {
      expr: body.expr ?? '',
      outputFields: body.outputFields,
      limit: clampEntityLimit(body.limit),
      fullVector: false,
    });
  }

  @Post('collections/:name/search')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  search(
    @Param('name') name: string,
    @Body() body: { query?: string; topK?: number },
  ) {
    return this.service.search(name, {
      query: body?.query ?? '',
      topK: body?.topK,
    });
  }
}
