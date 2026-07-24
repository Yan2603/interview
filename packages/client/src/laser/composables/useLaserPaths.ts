import type { ExtractableBoundsObject, PathSnapshot } from '../types';
import { extractPathsFromObjects } from '../utils/pathExtract';

export function buildLaserPaths(objects: ExtractableBoundsObject[]): PathSnapshot[] {
  return extractPathsFromObjects(objects);
}
