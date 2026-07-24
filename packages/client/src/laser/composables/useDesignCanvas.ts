import { onBeforeUnmount, ref, type Ref } from 'vue';
import {
  Canvas,
  Rect,
  Ellipse,
  Line,
  FabricText,
  FabricImage,
  util,
  loadSVGFromString,
} from 'fabric';
import type { FabricObject } from 'fabric';
import type { ExtractableBoundsObject } from '../types';
import {
  readFileAsDataURL,
  readFileAsText,
  validateImportFile,
} from '../utils/import';

function ensureObjectId(obj: FabricObject): string {
  const anyObj = obj as FabricObject & { laserId?: string };
  if (!anyObj.laserId) {
    anyObj.laserId = `obj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
  return anyObj.laserId;
}

export function useDesignCanvas(canvasEl: Ref<HTMLCanvasElement | null>) {
  const ready = ref(false);
  const selectedCount = ref(0);
  const objectCount = ref(0);
  let canvas: Canvas | null = null;

  function refreshCounts() {
    if (!canvas) return;
    objectCount.value = canvas.getObjects().length;
    selectedCount.value = canvas.getActiveObjects().length;
  }

  function init() {
    if (!canvasEl.value || canvas) return;
    canvas = new Canvas(canvasEl.value, {
      width: 900,
      height: 560,
      backgroundColor: '#fafafa',
      preserveObjectStacking: true,
    });
    canvas.on('selection:created', refreshCounts);
    canvas.on('selection:updated', refreshCounts);
    canvas.on('selection:cleared', refreshCounts);
    canvas.on('object:added', refreshCounts);
    canvas.on('object:removed', refreshCounts);
    ready.value = true;
    refreshCounts();
  }

  function dispose() {
    canvas?.dispose();
    canvas = null;
    ready.value = false;
  }

  function setLocked(locked: boolean) {
    if (!canvas) return;
    canvas.selection = !locked;
    canvas.forEachObject((obj) => {
      obj.selectable = !locked;
      obj.evented = !locked;
    });
    if (locked) canvas.discardActiveObject();
    canvas.requestRenderAll();
    refreshCounts();
  }

  function addRect() {
    if (!canvas) return;
    const rect = new Rect({
      left: 80,
      top: 80,
      width: 120,
      height: 80,
      fill: 'transparent',
      stroke: '#1677ff',
      strokeWidth: 2,
    });
    ensureObjectId(rect);
    canvas.add(rect);
    canvas.setActiveObject(rect);
    canvas.requestRenderAll();
  }

  function addEllipse() {
    if (!canvas) return;
    const ellipse = new Ellipse({
      left: 100,
      top: 100,
      rx: 60,
      ry: 40,
      fill: 'transparent',
      stroke: '#52c41a',
      strokeWidth: 2,
    });
    ensureObjectId(ellipse);
    canvas.add(ellipse);
    canvas.setActiveObject(ellipse);
    canvas.requestRenderAll();
  }

  function addLine() {
    if (!canvas) return;
    const line = new Line([50, 50, 200, 120], {
      stroke: '#fa8c16',
      strokeWidth: 2,
    });
    ensureObjectId(line);
    canvas.add(line);
    canvas.setActiveObject(line);
    canvas.requestRenderAll();
  }

  function addText() {
    if (!canvas) return;
    const text = new FabricText('激光文字', {
      left: 120,
      top: 120,
      fontSize: 28,
      fill: '#262626',
    });
    ensureObjectId(text);
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.requestRenderAll();
  }

  function deleteSelected() {
    if (!canvas) return;
    const active = canvas.getActiveObjects();
    if (!active.length) return;
    canvas.remove(...active);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    refreshCounts();
  }

  function clearAll() {
    canvas?.clear();
    if (canvas) canvas.backgroundColor = '#fafafa';
    canvas?.requestRenderAll();
    refreshCounts();
  }

  async function importFile(file: File): Promise<void> {
    if (!canvas) throw new Error('画布未就绪');
    const validation = validateImportFile(file);
    if (!validation.ok) throw new Error(validation.message);
    if (validation.kind === 'image') {
      const dataUrl = await readFileAsDataURL(file);
      const img = await FabricImage.fromURL(dataUrl);
      img.scaleToWidth(240);
      img.set({ left: 60, top: 60 });
      ensureObjectId(img);
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.requestRenderAll();
      return;
    }
    const svgText = await readFileAsText(file);
    // Fabric 6.6.1: loadSVGFromString is a top-level export, not on util
    const { objects, options } = await loadSVGFromString(svgText);
    const items = objects.filter(Boolean) as FabricObject[];
    if (!items.length) throw new Error('SVG 内容无效或为空');
    const group = util.groupSVGElements(items, options);
    group.set({ left: 60, top: 60 });
    ensureObjectId(group);
    canvas.add(group);
    canvas.setActiveObject(group);
    canvas.requestRenderAll();
  }

  function exportSvg(): string | null {
    if (!canvas || canvas.getObjects().length === 0) return null;
    return canvas.toSVG();
  }

  function exportJson(): string | null {
    if (!canvas || canvas.getObjects().length === 0) return null;
    return JSON.stringify(canvas.toJSON());
  }

  function toExtractable(obj: FabricObject): ExtractableBoundsObject {
    const br = obj.getBoundingRect();
    return {
      id: ensureObjectId(obj),
      type: obj.type ?? 'object',
      bounds: {
        left: br.left,
        top: br.top,
        width: br.width,
        height: br.height,
      },
    };
  }

  /** Prefer selection; if empty, return all objects. */
  function getObjectsForSimulation(): ExtractableBoundsObject[] {
    if (!canvas) return [];
    const active = canvas.getActiveObjects();
    const source = active.length ? active : canvas.getObjects();
    return source.map(toExtractable);
  }

  onBeforeUnmount(dispose);

  return {
    ready,
    selectedCount,
    objectCount,
    init,
    dispose,
    setLocked,
    addRect,
    addEllipse,
    addLine,
    addText,
    deleteSelected,
    clearAll,
    importFile,
    exportSvg,
    exportJson,
    getObjectsForSimulation,
  };
}
