import { createHash } from 'crypto';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getImagesDir, resolveUploadRoot } from './upload-path';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

@Injectable()
export class UploadsService {
  readonly uploadRoot: string;

  constructor(private readonly config: ConfigService) {
    this.uploadRoot = resolveUploadRoot(this.config.get<string>('UPLOAD_DIR'));
  }

  saveImage(file: { buffer: Buffer; mimetype: string }): { url: string } {
    if (!file?.buffer?.length) {
      throw new BadRequestException('未收到文件');
    }

    const ext = MIME_TO_EXT[file.mimetype];
    if (!ext) {
      throw new BadRequestException('仅支持 jpeg/png/gif/webp 图片');
    }

    const hash = createHash('sha256').update(file.buffer).digest('hex');
    const filename = `${hash}.${ext}`;
    const imagesDir = getImagesDir(this.uploadRoot);
    const filepath = join(imagesDir, filename);

    if (!existsSync(filepath)) {
      writeFileSync(filepath, file.buffer);
    }

    return { url: `/uploads/images/${filename}` };
  }
}
