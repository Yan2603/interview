import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { UploadsService } from './uploads.service';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const MAX_SIZE = 5 * 1024 * 1024;

/** 上传文件形态（multer 默认 memoryStorage） */
interface UploadedImageFile {
  buffer: Buffer;
  mimetype: string;
  originalname?: string;
  size?: number;
}

@Controller('uploads')
export class UploadsController {
  constructor(private readonly service: UploadsService) {}

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_SIZE },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME.has(file.mimetype)) {
          cb(new BadRequestException('仅支持 jpeg/png/gif/webp 图片') as unknown as Error, false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  upload(@UploadedFile() file: UploadedImageFile) {
    if (!file) {
      throw new BadRequestException('请选择图片文件（字段名 file）');
    }
    return this.service.saveImage(file);
  }
}
