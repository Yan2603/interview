import { describe, expect, it } from 'vitest';
import { buildExportFilename } from './export';

describe('buildExportFilename', () => {
  it('returns svg filename', () => {
    expect(buildExportFilename('svg')).toBe('laser-design.svg');
  });

  it('returns json filename', () => {
    expect(buildExportFilename('json')).toBe('laser-design.json');
  });
});
