import { readFile } from 'fs/promises';
import { extname } from 'path';
import { Document } from '@langchain/core/documents';
import mammoth from 'mammoth';

// pdf-parse 无官方类型定义
const pdfParse = require('pdf-parse') as (data: Buffer) => Promise<{ text: string }>;

export type DocumentMetadata = Record<string, string | number | boolean | null>;

/**
 * 按扩展名加载本地文件为 LangChain Document，并合并调用方 metadata。
 */
export async function loadDocumentFile(
  filePath: string,
  metadata: DocumentMetadata = {},
): Promise<Document[]> {
  const ext = extname(filePath).toLowerCase();

  switch (ext) {
    case '.txt':
    case '.md': {
      const text = await readFile(filePath, 'utf-8');
      return [new Document({ pageContent: text, metadata: { ...metadata } })];
    }
    case '.pdf': {
      const buffer = await readFile(filePath);
      const parsed = await pdfParse(buffer);
      return [
        new Document({
          pageContent: parsed.text ?? '',
          metadata: { ...metadata },
        }),
      ];
    }
    case '.docx': {
      const result = await mammoth.extractRawText({ path: filePath });
      return [
        new Document({
          pageContent: result.value ?? '',
          metadata: { ...metadata },
        }),
      ];
    }
    default:
      throw new Error(`不支持的文件类型: ${ext || '(无扩展名)'}`);
  }
}
