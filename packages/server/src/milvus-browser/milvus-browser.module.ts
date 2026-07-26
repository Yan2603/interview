import { Module } from '@nestjs/common';
import { MilvusBrowserController } from './milvus-browser.controller';
import { MilvusBrowserService } from './milvus-browser.service';

@Module({
  controllers: [MilvusBrowserController],
  providers: [MilvusBrowserService],
})
export class MilvusBrowserModule {}
