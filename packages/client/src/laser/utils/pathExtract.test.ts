import { describe, expect, it } from 'vitest';
import { boundsToPathD, extractPathsFromObjects } from './pathExtract';

describe('boundsToPathD', () => {
  it('builds a closed rectangle path from bounds', () => {
    expect(boundsToPathD({ left: 10, top: 20, width: 100, height: 50 })).toBe(
      'M 10 20 H 110 V 70 H 10 Z',
    );
  });
});

describe('extractPathsFromObjects', () => {
  it('returns empty array for empty input', () => {
    expect(extractPathsFromObjects([])).toEqual([]);
  });

  it('skips objects with non-positive size', () => {
    expect(
      extractPathsFromObjects([
        { id: 'a', type: 'rect', bounds: { left: 0, top: 0, width: 0, height: 10 } },
        { id: 'b', type: 'image', bounds: { left: 0, top: 0, width: 10, height: -1 } },
      ]),
    ).toEqual([]);
  });

  it('maps objects to ordered PathSnapshots using bounding boxes', () => {
    const result = extractPathsFromObjects([
      { id: 'r1', type: 'rect', bounds: { left: 0, top: 0, width: 10, height: 10 } },
      { id: 'img1', type: 'image', bounds: { left: 5, top: 5, width: 20, height: 15 } },
    ]);
    expect(result).toEqual([
      {
        id: 'path-0',
        d: 'M 0 0 H 10 V 10 H 0 Z',
        order: 0,
        sourceObjectId: 'r1',
      },
      {
        id: 'path-1',
        d: 'M 5 5 H 25 V 20 H 5 Z',
        order: 1,
        sourceObjectId: 'img1',
      },
    ]);
  });
});
