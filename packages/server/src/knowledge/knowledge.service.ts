import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { extname, join } from 'path';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { resolveUploadRoot } from '../uploads/upload-path';
import { RagService } from '../rag/rag.service';
import { loadDocumentFile } from './document-loader';
import { KnowledgeDocument } from './entities/knowledge-document.entity';

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXT = new Set(['.md', '.txt', '.pdf', '.docx']);

const EXT_TO_MIME: Record<string, string> = {
  '.md': 'text/markdown',
  '.txt': 'text/plain',
  '.pdf': 'application/pdf',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export interface KnowledgeDocumentDto {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: KnowledgeDocument['status'];
  errorMessage: string | null;
  chunkCount: number;
  createdAt: Date;
}

export interface UploadedKnowledgeFile {
  buffer: Buffer;
  mimetype?: string;
  originalname?: string;
  size?: number;
}

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);
  private readonly uploadRoot: string;
  private readonly knowledgeDir: string;

  constructor(
    private readonly config: ConfigService,
    private readonly rag: RagService,
    @InjectRepository(KnowledgeDocument)
    private readonly repo: Repository<KnowledgeDocument>,
  ) {
    this.uploadRoot = resolveUploadRoot(this.config.get<string>('UPLOAD_DIR'));
    this.knowledgeDir = join(this.uploadRoot, 'knowledge');
    mkdirSync(this.knowledgeDir, { recursive: true });
  }

  async uploadDocument(file: UploadedKnowledgeFile): Promise<KnowledgeDocumentDto> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('请选择文件（字段名 file）');
    }

    const originalName = file.originalname?.trim() || 'untitled.txt';
    const ext = extname(originalName).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      throw new BadRequestException('仅支持 .md / .txt / .pdf / .docx');
    }

    const size = file.size ?? file.buffer.length;
    if (size > MAX_SIZE) {
      throw new BadRequestException('文件大小不能超过 10MB');
    }

    const storageName = `${randomUUID()}${ext}`;
    const storagePath = join(this.knowledgeDir, storageName);
    writeFileSync(storagePath, file.buffer);

    const mimeType = EXT_TO_MIME[ext] || file.mimetype || 'application/octet-stream';
    const doc = await this.repo.save(
      this.repo.create({
        filename: originalName,
        mimeType,
        storagePath,
        sizeBytes: String(size),
        status: 'pending',
        errorMessage: null,
        chunkCount: 0,
      }),
    );

    await this.indexDocument(doc.id);
    const refreshed = await this.repo.findOneByOrFail({ id: doc.id });
    return this.toDto(refreshed);
  }

  async indexDocument(id: string): Promise<KnowledgeDocument> {
    const doc = await this.repo.findOneBy({ id });
    if (!doc) {
      throw new NotFoundException('文档不存在');
    }

    try {
      if (!existsSync(doc.storagePath)) {
        throw new Error(`磁盘文件不存在: ${doc.storagePath}`);
      }

      // 重新索引前先清掉旧向量，避免重复
      await this.rag.deleteBySource('document', doc.id);

      const loaded = await loadDocumentFile(doc.storagePath, {
        sourceType: 'document',
        sourceId: doc.id,
        title: doc.filename,
      });

      const chunks = await this.rag.splitDocuments(loaded);
      chunks.forEach((chunk, chunkIndex) => {
        chunk.metadata = {
          ...chunk.metadata,
          sourceType: 'document',
          sourceId: doc.id,
          title: doc.filename,
          chunkIndex,
        };
      });

      await this.rag.addDocuments(chunks);

      doc.status = 'ready';
      doc.chunkCount = chunks.length;
      doc.errorMessage = null;
      return this.repo.save(doc);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`indexDocument failed id=${id}: ${message}`);
      doc.status = 'failed';
      doc.errorMessage = message;
      return this.repo.save(doc);
    }
  }

  async listDocuments(): Promise<KnowledgeDocumentDto[]> {
    const docs = await this.repo.find({ order: { createdAt: 'DESC' } });
    return docs.map((d) => this.toDto(d));
  }

  async removeDocument(id: string): Promise<void> {
    const doc = await this.repo.findOneBy({ id });
    if (!doc) {
      throw new NotFoundException('文档不存在');
    }

    try {
      await this.rag.deleteBySource('document', id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`deleteBySource failed id=${id}: ${message}`);
      throw new InternalServerErrorException('删除向量数据失败，请稍后重试');
    }

    this.unlinkStorageFile(doc.storagePath);

    await this.repo.remove(doc);
  }

  private unlinkStorageFile(storagePath: string): void {
    if (!existsSync(storagePath)) {
      return;
    }

    try {
      unlinkSync(storagePath);
    } catch (err) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === 'ENOENT') {
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`unlink failed path=${storagePath}: ${message}`);
      throw new InternalServerErrorException('删除磁盘文件失败，请稍后重试');
    }
  }

  private toDto(doc: KnowledgeDocument): KnowledgeDocumentDto {
    return {
      id: doc.id,
      filename: doc.filename,
      mimeType: doc.mimeType,
      sizeBytes: Number(doc.sizeBytes),
      status: doc.status,
      errorMessage: doc.errorMessage,
      chunkCount: doc.chunkCount,
      createdAt: doc.createdAt,
    };
  }
}
