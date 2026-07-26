import { describe, expect, it } from 'vitest';
import {
  clampEntityLimit,
  ENTITY_LIMIT_MAX,
  mapEntityRow,
  truncateVector,
} from './vector-display';

describe('clampEntityLimit', () => {
  it('uses fallback for invalid input', () => {
    expect(clampEntityLimit(undefined)).toBe(50);
    expect(clampEntityLimit('x', 20)).toBe(20);
  });
  it('clamps to ENTITY_LIMIT_MAX', () => {
    expect(clampEntityLimit(999)).toBe(ENTITY_LIMIT_MAX);
  });
  it('accepts valid positive ints', () => {
    expect(clampEntityLimit(10)).toBe(10);
  });
});

describe('truncateVector', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  it('returns preview when not full', () => {
    expect(truncateVector(v, false, 3)).toEqual({
      truncated: true,
      dim: 10,
      preview: [1, 2, 3],
    });
  });
  it('returns full values when full', () => {
    expect(truncateVector(v, true)).toEqual({
      truncated: false,
      dim: 10,
      values: v,
    });
  });
});

describe('mapEntityRow', () => {
  it('truncates named vector fields', () => {
    const row = mapEntityRow(
      { text: 'hi', vector: [0.1, 0.2, 0.3, 0.4] },
      ['vector'],
      false,
    );
    expect(row.text).toBe('hi');
    expect(row.vector).toEqual({
      truncated: true,
      dim: 4,
      preview: [0.1, 0.2, 0.3, 0.4].slice(0, 8),
    });
  });
});
