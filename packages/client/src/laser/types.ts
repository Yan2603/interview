export type EditorMode = 'edit' | 'preview';

export type ExportFormat = 'svg' | 'json';

export type PathSnapshot = {
  id: string;
  d: string;
  order: number;
  sourceObjectId?: string;
};

/** Axis-aligned bounds already in canvas coordinates (after Fabric transforms). */
export type ExtractableBoundsObject = {
  id: string;
  type: string;
  bounds: { left: number; top: number; width: number; height: number };
};
