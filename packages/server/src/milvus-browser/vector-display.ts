export const ENTITY_LIMIT_MAX = 200;

export function clampEntityLimit(limit: unknown, fallback = 50): number {
  const n = typeof limit === 'number' ? limit : Number.parseInt(String(limit ?? ''), 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), ENTITY_LIMIT_MAX);
}

export type TruncatedVector =
  | { truncated: true; dim: number; preview: number[] }
  | { truncated: false; dim: number; values: number[] };

export function truncateVector(
  values: number[],
  full: boolean,
  previewDims = 8,
): TruncatedVector {
  const dim = values.length;
  if (full) return { truncated: false, dim, values };
  return { truncated: true, dim, preview: values.slice(0, previewDims) };
}

function isNumberArray(v: unknown): v is number[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'number');
}

export function mapEntityRow(
  row: Record<string, unknown>,
  vectorFieldNames: string[],
  fullVector: boolean,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  const set = new Set(vectorFieldNames);
  for (const key of Object.keys(out)) {
    if (!set.has(key)) continue;
    const val = out[key];
    if (isNumberArray(val)) {
      out[key] = truncateVector(val, fullVector);
    }
  }
  return out;
}
