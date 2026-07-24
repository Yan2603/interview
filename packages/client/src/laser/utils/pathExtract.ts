import type { ExtractableBoundsObject, PathSnapshot } from '../types';

export function boundsToPathD(bounds: {
  left: number;
  top: number;
  width: number;
  height: number;
}): string {
  const right = bounds.left + bounds.width;
  const bottom = bounds.top + bounds.height;
  return `M ${bounds.left} ${bounds.top} H ${right} V ${bottom} H ${bounds.left} Z`;
}

export function extractPathsFromObjects(
  objects: ExtractableBoundsObject[],
): PathSnapshot[] {
  const snapshots: PathSnapshot[] = [];
  for (const obj of objects) {
    const { width, height } = obj.bounds;
    if (width <= 0 || height <= 0) continue;
    const order = snapshots.length;
    snapshots.push({
      id: `path-${order}`,
      d: boundsToPathD(obj.bounds),
      order,
      sourceObjectId: obj.id,
    });
  }
  return snapshots;
}
