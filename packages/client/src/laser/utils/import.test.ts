import { describe, expect, it } from 'vitest';
import { MAX_IMPORT_BYTES, validateImportFile } from './import';

describe('validateImportFile', () => {
  it('rejects oversized files', () => {
    const result = validateImportFile({
      name: 'big.png',
      size: MAX_IMPORT_BYTES + 1,
      type: 'image/png',
    });
    expect(result).toEqual({ ok: false, message: '文件不能超过 5MB' });
  });

  it('accepts png/jpeg/webp/gif by mime or extension', () => {
    expect(validateImportFile({ name: 'a.png', size: 10, type: 'image/png' })).toEqual({
      ok: true,
      kind: 'image',
    });
    expect(validateImportFile({ name: 'a.JPG', size: 10, type: '' })).toEqual({
      ok: true,
      kind: 'image',
    });
  });

  it('accepts svg by mime or extension', () => {
    expect(
      validateImportFile({ name: 'a.svg', size: 10, type: 'image/svg+xml' }),
    ).toEqual({ ok: true, kind: 'svg' });
  });

  it('rejects unsupported types', () => {
    expect(validateImportFile({ name: 'a.pdf', size: 10, type: 'application/pdf' })).toEqual({
      ok: false,
      message: '仅支持图片或 SVG 文件',
    });
  });
});
