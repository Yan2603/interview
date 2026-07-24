# Laser Editor (Fabric.js Dual Canvas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/laser` route module with Fabric.js design canvas + bare Canvas 2D preview, covering edit/import/export and ordered path simulation for interview practice.

**Architecture:** All laser code lives under `packages/client/src/laser/`. Design layer (Fabric) is the source of truth; preview layer consumes `PathSnapshot[]` only. Mode switches between `edit` and `preview` without persisting preview state.

**Tech Stack:** Vue 3, Vite, Ant Design Vue, Fabric.js `6.6.1`, Vitest (existing client test runner).

## Global Constraints

- Laser code only under `packages/client/src/laser/` (plus minimal router/nav wiring outside).
- Design canvas: Fabric.js; preview canvas: bare Canvas 2D (no second Fabric instance).
- File import size limit: **5MB**.
- Image path extraction: **axis-aligned bounding box only** (no raster vectorization).
- No G-code, no backend APIs, no undo/layers.
- Prefer TDD for pure utils (`pathExtract`, import validation, download helpers).
- Chinese UI copy via Ant Design Vue `message` / button labels.

## File Map

| Path | Responsibility |
|---|---|
| `packages/client/package.json` | Add `fabric@6.6.1` |
| `packages/client/src/laser/types.ts` | Shared types |
| `packages/client/src/laser/utils/pathExtract.ts` | Objects → `PathSnapshot[]` |
| `packages/client/src/laser/utils/pathExtract.test.ts` | Unit tests |
| `packages/client/src/laser/utils/export.ts` | SVG/JSON download helpers |
| `packages/client/src/laser/utils/export.test.ts` | Unit tests |
| `packages/client/src/laser/utils/import.ts` | File validation + load helpers |
| `packages/client/src/laser/utils/import.test.ts` | Unit tests |
| `packages/client/src/laser/composables/useDesignCanvas.ts` | Fabric lifecycle + object ops |
| `packages/client/src/laser/composables/usePreviewCanvas.ts` | Path playback on 2D canvas |
| `packages/client/src/laser/composables/useLaserPaths.ts` | Bridge: selection → snapshots |
| `packages/client/src/laser/components/DesignCanvas.vue` | Design canvas host |
| `packages/client/src/laser/components/PreviewCanvas.vue` | Preview canvas host |
| `packages/client/src/laser/components/LaserToolbar.vue` | Tools / import / export / mode |
| `packages/client/src/laser/LaserEditorView.vue` | Page shell + mode orchestration |
| `packages/client/src/router/index.ts` | Add `/laser` route |
| `packages/client/src/components/layout/AppLayout.vue` | Side nav entry + selected key |

---

### Task 1: Types, dependency, route & nav shell

**Files:**
- Modify: `packages/client/package.json`
- Create: `packages/client/src/laser/types.ts`
- Create: `packages/client/src/laser/LaserEditorView.vue` (placeholder page)
- Modify: `packages/client/src/router/index.ts`
- Modify: `packages/client/src/components/layout/AppLayout.vue`

**Interfaces:**
- Consumes: existing Vue Router / AppLayout menu patterns
- Produces: `EditorMode`, `PathSnapshot`, `ExportFormat`, `ExtractableBoundsObject` exported from `types.ts`; route `/laser` reachable from nav

- [ ] **Step 1: Install Fabric.js**

From repo root:

```bash
pnpm --filter @interview/client add fabric@6.6.1
```

Expected: `packages/client/package.json` lists `"fabric": "6.6.1"` (or exact resolved `6.6.1`).

- [ ] **Step 2: Create types**

Create `packages/client/src/laser/types.ts`:

```ts
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
```

- [ ] **Step 3: Placeholder view + route**

Create `packages/client/src/laser/LaserEditorView.vue`:

```vue
<script setup lang="ts">
</script>

<template>
  <div class="laser-editor">
    <h2>激光雕刻画板</h2>
    <p>双 Canvas 编辑器（建设中）</p>
  </div>
</template>

<style scoped>
.laser-editor {
  padding: 16px;
  background: #fff;
  min-height: calc(100vh - 48px);
}
</style>
```

In `packages/client/src/router/index.ts`, add route (alongside existing routes):

```ts
{
  path: '/laser',
  component: () => import('../laser/LaserEditorView.vue'),
  meta: { title: '激光画板' },
},
```

- [ ] **Step 4: Side nav entry**

In `AppLayout.vue` `mainSelectedKeys`:

```ts
const mainSelectedKeys = computed(() => {
  if (route.path.startsWith('/questions')) return ['questions'];
  if (route.path.startsWith('/calendar')) return ['calendar'];
  if (route.path.startsWith('/laser')) return ['laser'];
  return ['dashboard'];
});
```

In the menu template, after the calendar item:

```vue
<a-menu-item key="laser">
  <router-link to="/laser">激光画板</router-link>
</a-menu-item>
```

- [ ] **Step 5: Smoke-check route**

Run: `pnpm --filter @interview/client dev`

Open `http://localhost:5173/laser` — placeholder heading visible; side nav highlights「激光画板」.

- [ ] **Step 6: Commit**

```bash
git add packages/client/package.json packages/client/pnpm-lock.yaml pnpm-lock.yaml packages/client/src/laser/types.ts packages/client/src/laser/LaserEditorView.vue packages/client/src/router/index.ts packages/client/src/components/layout/AppLayout.vue
git commit -m "feat(laser): scaffold /laser route, types, and Fabric dependency"
```

(If lockfile only exists at repo root, add that path instead.)

---

### Task 2: Path extraction (TDD)

**Files:**
- Create: `packages/client/src/laser/utils/pathExtract.ts`
- Create: `packages/client/src/laser/utils/pathExtract.test.ts`

**Interfaces:**
- Consumes: `ExtractableBoundsObject`, `PathSnapshot` from `../types`
- Produces:
  - `boundsToPathD(bounds): string`
  - `extractPathsFromObjects(objects: ExtractableBoundsObject[]): PathSnapshot[]`

- [ ] **Step 1: Write failing tests**

Create `packages/client/src/laser/utils/pathExtract.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pnpm --filter @interview/client test -- src/laser/utils/pathExtract.test.ts
```

Expected: FAIL (module not found / exports missing).

- [ ] **Step 3: Implement**

Create `packages/client/src/laser/utils/pathExtract.ts`:

```ts
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
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm --filter @interview/client test -- src/laser/utils/pathExtract.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/laser/utils/pathExtract.ts packages/client/src/laser/utils/pathExtract.test.ts
git commit -m "feat(laser): add bounding-box path extraction utils"
```

---

### Task 3: Import validation & export download helpers (TDD)

**Files:**
- Create: `packages/client/src/laser/utils/import.ts`
- Create: `packages/client/src/laser/utils/import.test.ts`
- Create: `packages/client/src/laser/utils/export.ts`
- Create: `packages/client/src/laser/utils/export.test.ts`

**Interfaces:**
- Consumes: none from Fabric (pure)
- Produces:
  - `MAX_IMPORT_BYTES = 5 * 1024 * 1024`
  - `validateImportFile(file: { name: string; size: number; type: string }): { ok: true; kind: 'image' | 'svg' } | { ok: false; message: string }`
  - `readFileAsDataURL(file: File): Promise<string>`
  - `readFileAsText(file: File): Promise<string>`
  - `downloadTextFile(filename: string, content: string, mime: string): void`
  - `buildExportFilename(format: 'svg' | 'json'): string`

- [ ] **Step 1: Write failing import tests**

Create `packages/client/src/laser/utils/import.test.ts`:

```ts
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
```

- [ ] **Step 2: Write failing export tests**

Create `packages/client/src/laser/utils/export.test.ts`:

```ts
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
```

- [ ] **Step 3: Run tests — expect FAIL**

```bash
pnpm --filter @interview/client test -- src/laser/utils/import.test.ts src/laser/utils/export.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement import.ts**

```ts
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export type ImportKind = 'image' | 'svg';

export type ImportValidation =
  | { ok: true; kind: ImportKind }
  | { ok: false; message: string };

function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

export function validateImportFile(file: {
  name: string;
  size: number;
  type: string;
}): ImportValidation {
  if (file.size > MAX_IMPORT_BYTES) {
    return { ok: false, message: '文件不能超过 5MB' };
  }
  const ext = extensionOf(file.name);
  const mime = file.type.toLowerCase();
  if (
    mime === 'image/svg+xml' ||
    ext === 'svg'
  ) {
    return { ok: true, kind: 'svg' };
  }
  if (
    mime.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)
  ) {
    return { ok: true, kind: 'image' };
  }
  return { ok: false, message: '仅支持图片或 SVG 文件' };
}

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsText(file);
  });
}
```

- [ ] **Step 5: Implement export.ts**

```ts
import type { ExportFormat } from '../types';

export function buildExportFilename(format: ExportFormat): string {
  return format === 'svg' ? 'laser-design.svg' : 'laser-design.json';
}

export function downloadTextFile(
  filename: string,
  content: string,
  mime: string,
): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 6: Run tests — expect PASS**

```bash
pnpm --filter @interview/client test -- src/laser/utils/import.test.ts src/laser/utils/export.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/client/src/laser/utils/import.ts packages/client/src/laser/utils/import.test.ts packages/client/src/laser/utils/export.ts packages/client/src/laser/utils/export.test.ts
git commit -m "feat(laser): add import validation and export download helpers"
```

---

### Task 4: Design canvas composable + component

**Files:**
- Create: `packages/client/src/laser/composables/useDesignCanvas.ts`
- Create: `packages/client/src/laser/components/DesignCanvas.vue`

**Interfaces:**
- Consumes: `fabric` Canvas API; import/export utils
- Produces `useDesignCanvas(canvasEl: Ref<HTMLCanvasElement | null>)` returning:
  - `ready: Ref<boolean>`
  - `selectedCount: Ref<number>`
  - `objectCount: Ref<number>`
  - `init(): void` / `dispose(): void`
  - `setLocked(locked: boolean): void`
  - `addRect()`, `addEllipse()`, `addLine()`, `addText()`
  - `deleteSelected()`, `clearAll()`
  - `importFile(file: File): Promise<void>`
  - `exportSvg(): string | null`, `exportJson(): string | null`
  - `getObjectsForSimulation(): ExtractableBoundsObject[]`

- [ ] **Step 1: Implement `useDesignCanvas.ts`**

```ts
import { onBeforeUnmount, ref, type Ref } from 'vue';
import { Canvas, Rect, Ellipse, Line, FabricText, FabricImage, util } from 'fabric';
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
    const { objects, options } = await util.loadSVGFromString(svgText);
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
```

- [ ] **Step 2: Implement `DesignCanvas.vue`**

```vue
<script setup lang="ts">
import { onMounted, ref, nextTick } from 'vue';
import { useDesignCanvas } from '../composables/useDesignCanvas';

const canvasRef = ref<HTMLCanvasElement | null>(null);
const design = useDesignCanvas(canvasRef);

defineExpose(design);

onMounted(async () => {
  await nextTick();
  design.init();
});
</script>

<template>
  <canvas ref="canvasRef" class="design-canvas" />
</template>

<style scoped>
.design-canvas {
  display: block;
  border: 1px solid #d9d9d9;
  max-width: 100%;
}
</style>
```

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/laser/composables/useDesignCanvas.ts packages/client/src/laser/components/DesignCanvas.vue
git commit -m "feat(laser): add Fabric design canvas composable and component"
```

---

### Task 5: Preview canvas + path bridge

**Files:**
- Create: `packages/client/src/laser/composables/useLaserPaths.ts`
- Create: `packages/client/src/laser/composables/usePreviewCanvas.ts`
- Create: `packages/client/src/laser/components/PreviewCanvas.vue`

**Interfaces:**
- Consumes: `extractPathsFromObjects`, `PathSnapshot`, `ExtractableBoundsObject`
- Produces:
  - `buildLaserPaths(objects: ExtractableBoundsObject[]): PathSnapshot[]` in `useLaserPaths.ts` (thin wrapper)
  - `usePreviewCanvas(canvasEl)` with `load(paths)`, `play()`, `pause()`, `reset()`, `clear()`, `dispose()`, `progress: Ref<number>`, `playing: Ref<boolean>`

- [ ] **Step 1: Implement `useLaserPaths.ts`**

```ts
import type { ExtractableBoundsObject, PathSnapshot } from '../types';
import { extractPathsFromObjects } from '../utils/pathExtract';

export function buildLaserPaths(objects: ExtractableBoundsObject[]): PathSnapshot[] {
  return extractPathsFromObjects(objects);
}
```

- [ ] **Step 2: Implement `usePreviewCanvas.ts`**

Path drawing strategy: parse simple `M x y H x2 V y2 H x Z` rectangles produced by `boundsToPathD`, stroke perimeter progressively with `requestAnimationFrame`.

```ts
import { onBeforeUnmount, ref, type Ref } from 'vue';
import type { PathSnapshot } from '../types';

type Point = { x: number; y: number };

function rectPathToPoints(d: string): Point[] {
  // Expect: M L T H R V B H L Z  (from boundsToPathD)
  const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  // boundsToPathD: M l t H r V b H l Z → nums: l,t,r,b,l
  if (nums.length < 5) return [];
  const left = nums[0];
  const top = nums[1];
  const right = nums[2];
  const bottom = nums[3];
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
    { x: left, y: top },
  ];
}

export function usePreviewCanvas(canvasEl: Ref<HTMLCanvasElement | null>) {
  const playing = ref(false);
  const progress = ref(0); // 0..1
  let ctx: CanvasRenderingContext2D | null = null;
  let paths: PathSnapshot[] = [];
  let raf = 0;
  let segmentIndex = 0;
  let edgeProgress = 0;
  const SPEED = 4; // px per frame along edges

  function ensureCtx() {
    if (!canvasEl.value) return null;
    if (!ctx) {
      ctx = canvasEl.value.getContext('2d');
      canvasEl.value.width = 900;
      canvasEl.value.height = 560;
    }
    return ctx;
  }

  function clear() {
    const c = ensureCtx();
    if (!c || !canvasEl.value) return;
    c.clearRect(0, 0, canvasEl.value.width, canvasEl.value.height);
  }

  function drawBackgroundHint() {
    const c = ensureCtx();
    if (!c || !canvasEl.value) return;
    c.save();
    c.fillStyle = 'rgba(255,255,255,0.92)';
    c.fillRect(0, 0, canvasEl.value.width, canvasEl.value.height);
    c.restore();
  }

  function load(next: PathSnapshot[]) {
    pause();
    paths = next.slice().sort((a, b) => a.order - b.order);
    segmentIndex = 0;
    edgeProgress = 0;
    progress.value = 0;
    clear();
    drawBackgroundHint();
  }

  function totalEdges(): number {
    return paths.length * 4; // rectangle perimeter has 4 edges (closing edge drawn)
  }

  function frame() {
    const c = ensureCtx();
    if (!c || !playing.value) return;

    if (segmentIndex >= paths.length) {
      playing.value = false;
      progress.value = 1;
      return;
    }

    const points = rectPathToPoints(paths[segmentIndex].d);
    if (points.length < 2) {
      segmentIndex += 1;
      raf = requestAnimationFrame(frame);
      return;
    }

    // Draw all completed paths fully
    clear();
    drawBackgroundHint();
    c.strokeStyle = '#ff4d4f';
    c.lineWidth = 2;
    c.lineCap = 'round';

    for (let i = 0; i < segmentIndex; i++) {
      const pts = rectPathToPoints(paths[i].d);
      c.beginPath();
      pts.forEach((p, idx) => (idx === 0 ? c.moveTo(p.x, p.y) : c.lineTo(p.x, p.y)));
      c.stroke();
    }

    // Animate current path edge-by-edge
    c.beginPath();
    c.moveTo(points[0].x, points[0].y);
    let remaining = SPEED;
    let edge = Math.floor(edgeProgress);
    let distIntoEdge = edgeProgress - edge;

    // redraw completed edges of current path
    for (let e = 0; e < edge && e < points.length - 1; e++) {
      c.lineTo(points[e + 1].x, points[e + 1].y);
    }

    if (edge < points.length - 1) {
      const a = points[edge];
      const b = points[edge + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      let t = distIntoEdge + remaining / len;
      if (t >= 1) {
        c.lineTo(b.x, b.y);
        edgeProgress = edge + 1;
        remaining = (t - 1) * len;
        while (remaining > 0 && edgeProgress < points.length - 1) {
          const ea = Math.floor(edgeProgress);
          const pa = points[ea];
          const pb = points[ea + 1];
          const elen = Math.hypot(pb.x - pa.x, pb.y - pa.y) || 1;
          if (remaining >= elen) {
            c.lineTo(pb.x, pb.y);
            remaining -= elen;
            edgeProgress = ea + 1;
          } else {
            const tt = remaining / elen;
            c.lineTo(pa.x + (pb.x - pa.x) * tt, pa.y + (pb.y - pa.y) * tt);
            edgeProgress = ea + tt;
            remaining = 0;
          }
        }
      } else {
        c.lineTo(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
        edgeProgress = edge + t;
      }
    }
    c.stroke();

    if (edgeProgress >= points.length - 1) {
      segmentIndex += 1;
      edgeProgress = 0;
    }

    const doneEdges = segmentIndex * 4 + Math.min(4, Math.floor(edgeProgress));
    progress.value = Math.min(1, doneEdges / Math.max(1, totalEdges()));

    raf = requestAnimationFrame(frame);
  }

  function play() {
    if (!paths.length) return;
    if (segmentIndex >= paths.length) {
      segmentIndex = 0;
      edgeProgress = 0;
    }
    playing.value = true;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }

  function pause() {
    playing.value = false;
    cancelAnimationFrame(raf);
  }

  function reset() {
    pause();
    segmentIndex = 0;
    edgeProgress = 0;
    progress.value = 0;
    clear();
    drawBackgroundHint();
  }

  function dispose() {
    pause();
    ctx = null;
    paths = [];
  }

  onBeforeUnmount(dispose);

  return { playing, progress, load, play, pause, reset, clear, dispose };
}
```

Simplify if the progressive-edge logic is too heavy during implementation: acceptable fallback is **draw full path one-by-one with a timer** (still ordered simulation). Prefer the rAF version above; if stuck >30 minutes, replace `frame()` with sequential full-path strokes every 400ms.

- [ ] **Step 3: Implement `PreviewCanvas.vue`**

```vue
<script setup lang="ts">
import { onMounted, ref, nextTick } from 'vue';
import { usePreviewCanvas } from '../composables/usePreviewCanvas';

const canvasRef = ref<HTMLCanvasElement | null>(null);
const preview = usePreviewCanvas(canvasRef);

defineExpose(preview);

onMounted(async () => {
  await nextTick();
  preview.clear();
});
</script>

<template>
  <canvas ref="canvasRef" class="preview-canvas" />
</template>

<style scoped>
.preview-canvas {
  display: block;
  border: 1px solid #d9d9d9;
  max-width: 100%;
}
</style>
```

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/laser/composables/useLaserPaths.ts packages/client/src/laser/composables/usePreviewCanvas.ts packages/client/src/laser/components/PreviewCanvas.vue
git commit -m "feat(laser): add preview canvas path playback"
```

---

### Task 6: Toolbar + editor page integration

**Files:**
- Create: `packages/client/src/laser/components/LaserToolbar.vue`
- Modify: `packages/client/src/laser/LaserEditorView.vue`

**Interfaces:**
- Consumes: design/preview exposed methods; `buildLaserPaths`; `downloadTextFile` / `buildExportFilename`
- Produces: working `/laser` page with edit + preview modes

- [ ] **Step 1: Implement `LaserToolbar.vue`**

```vue
<script setup lang="ts">
import type { EditorMode } from '../types';

defineProps<{
  mode: EditorMode;
  selectedCount: number;
  objectCount: number;
  playing: boolean;
  progress: number;
}>();

const emit = defineEmits<{
  addRect: [];
  addEllipse: [];
  addLine: [];
  addText: [];
  deleteSelected: [];
  clearAll: [];
  importFile: [file: File];
  exportSvg: [];
  exportJson: [];
  startPreview: [];
  exitPreview: [];
  play: [];
  pause: [];
  reset: [];
}>();

function onImportChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) emit('importFile', file);
  input.value = '';
}
</script>

<template>
  <div class="laser-toolbar">
    <template v-if="mode === 'edit'">
      <a-space wrap>
        <a-button @click="emit('addRect')">矩形</a-button>
        <a-button @click="emit('addEllipse')">椭圆</a-button>
        <a-button @click="emit('addLine')">直线</a-button>
        <a-button @click="emit('addText')">文字</a-button>
        <a-button danger @click="emit('deleteSelected')">删除选中</a-button>
        <a-button @click="emit('clearAll')">清空</a-button>
        <a-upload :show-upload-list="false" :before-upload="() => false" @change="() => {}">
          <a-button>
            <label class="file-label">
              导入
              <input type="file" accept="image/*,.svg,image/svg+xml" hidden @change="onImportChange" />
            </label>
          </a-button>
        </a-upload>
        <a-button @click="emit('exportSvg')">导出 SVG</a-button>
        <a-button @click="emit('exportJson')">导出 JSON</a-button>
        <a-button type="primary" @click="emit('startPreview')">开始模拟</a-button>
      </a-space>
    </template>
    <template v-else>
      <a-space wrap>
        <a-button type="primary" :disabled="playing" @click="emit('play')">播放</a-button>
        <a-button :disabled="!playing" @click="emit('pause')">暂停</a-button>
        <a-button @click="emit('reset')">重播</a-button>
        <a-button @click="emit('exitPreview')">退出模拟</a-button>
        <span class="meta">进度 {{ Math.round(progress * 100) }}%</span>
      </a-space>
    </template>
    <div class="meta">模式：{{ mode === 'edit' ? '编辑' : '预览' }} · 选中 {{ selectedCount }} · 对象 {{ objectCount }}</div>
  </div>
</template>

<style scoped>
.laser-toolbar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}
.meta {
  color: #8c8c8c;
  font-size: 13px;
}
.file-label {
  cursor: pointer;
}
</style>
```

If `a-upload` wrapping is awkward, replace the import control with a plain `<input type="file">` + `a-button` label only (no `a-upload`).

- [ ] **Step 2: Rewrite `LaserEditorView.vue`**

```vue
<script setup lang="ts">
import { computed, ref } from 'vue';
import { message } from 'ant-design-vue';
import DesignCanvas from './components/DesignCanvas.vue';
import PreviewCanvas from './components/PreviewCanvas.vue';
import LaserToolbar from './components/LaserToolbar.vue';
import { buildLaserPaths } from './composables/useLaserPaths';
import { buildExportFilename, downloadTextFile } from './utils/export';
import type { EditorMode } from './types';

const mode = ref<EditorMode>('edit');
const designRef = ref<InstanceType<typeof DesignCanvas> | null>(null);
const previewRef = ref<InstanceType<typeof PreviewCanvas> | null>(null);

const selectedCount = computed(() => designRef.value?.selectedCount ?? 0);
const objectCount = computed(() => designRef.value?.objectCount ?? 0);
const playing = computed(() => previewRef.value?.playing ?? false);
const progress = computed(() => previewRef.value?.progress ?? 0);

async function onImportFile(file: File) {
  try {
    await designRef.value?.importFile(file);
    message.success('导入成功');
  } catch (e) {
    message.error(e instanceof Error ? e.message : '导入失败');
  }
}

function onExportSvg() {
  const svg = designRef.value?.exportSvg() ?? null;
  if (!svg) {
    message.warning('无可导出内容');
    return;
  }
  downloadTextFile(buildExportFilename('svg'), svg, 'image/svg+xml');
}

function onExportJson() {
  const json = designRef.value?.exportJson() ?? null;
  if (!json) {
    message.warning('无可导出内容');
    return;
  }
  downloadTextFile(buildExportFilename('json'), json, 'application/json');
}

function startPreview() {
  const objects = designRef.value?.getObjectsForSimulation() ?? [];
  const paths = buildLaserPaths(objects);
  if (!paths.length) {
    message.warning('没有可模拟的路径');
    return;
  }
  previewRef.value?.load(paths);
  designRef.value?.setLocked(true);
  mode.value = 'preview';
  previewRef.value?.play();
}

function exitPreview() {
  previewRef.value?.pause();
  previewRef.value?.clear();
  designRef.value?.setLocked(false);
  mode.value = 'edit';
}
</script>

<template>
  <div class="laser-editor">
    <h2>激光雕刻画板</h2>
    <LaserToolbar
      :mode="mode"
      :selected-count="selectedCount"
      :object-count="objectCount"
      :playing="playing"
      :progress="progress"
      @add-rect="designRef?.addRect()"
      @add-ellipse="designRef?.addEllipse()"
      @add-line="designRef?.addLine()"
      @add-text="designRef?.addText()"
      @delete-selected="designRef?.deleteSelected()"
      @clear-all="designRef?.clearAll()"
      @import-file="onImportFile"
      @export-svg="onExportSvg"
      @export-json="onExportJson"
      @start-preview="startPreview"
      @exit-preview="exitPreview"
      @play="previewRef?.play()"
      @pause="previewRef?.pause()"
      @reset="previewRef?.reset(); previewRef?.play()"
    />
    <div class="stage" :class="{ preview: mode === 'preview' }">
      <DesignCanvas ref="designRef" class="layer design" />
      <PreviewCanvas
        v-show="mode === 'preview'"
        ref="previewRef"
        class="layer preview-layer"
      />
    </div>
  </div>
</template>

<style scoped>
.laser-editor {
  padding: 16px;
  background: #fff;
  min-height: calc(100vh - 48px);
}
.stage {
  position: relative;
  width: 900px;
  max-width: 100%;
  height: 560px;
}
.layer {
  position: absolute;
  inset: 0;
}
.preview-layer {
  z-index: 2;
  pointer-events: none;
}
.design {
  z-index: 1;
}
</style>
```

- [ ] **Step 3: Typecheck / unit tests**

```bash
pnpm --filter @interview/client test
pnpm --filter @interview/client exec vue-tsc -b --pretty false
```

Expected: tests pass; fix any Fabric 6 type mismatches (`FabricText` vs `IText`, `getBoundingRect()` signature, `util.groupSVGElements`) until `vue-tsc` is clean.

- [ ] **Step 4: Manual acceptance**

Run `pnpm --filter @interview/client dev` and verify:

1. Add rect/ellipse/line/text; drag/scale/rotate  
2. Delete selected; clear  
3. Import PNG and SVG (<5MB); reject oversized with message  
4. Export SVG/JSON downloads; empty canvas warns  
5. Select objects → 开始模拟 → preview overlay animates in order  
6. Pause / 重播 / 退出模拟 returns to editable design  

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/laser/components/LaserToolbar.vue packages/client/src/laser/LaserEditorView.vue
git commit -m "feat(laser): wire toolbar and dual-canvas editor page"
```

---

## Spec Coverage Self-Review

| Spec requirement | Task |
|---|---|
| Unified `src/laser/` layout | 1–6 |
| Route `/laser` + nav | 1 |
| Fabric design + bare 2D preview | 4–5 |
| Shapes, text, transform, delete, clear | 4, 6 |
| Import image/SVG + 5MB limit | 3, 4, 6 |
| Export SVG/JSON + empty guard | 3, 4, 6 |
| Selection → ordered path simulation | 2, 5, 6 |
| Play/pause/reset/exit; lock design in preview | 5, 6 |
| Image = bbox path only | 2, 4 |
| Unit tests for pure utils | 2, 3 |
| Dispose on unmount | 4, 5 |

**Placeholder scan:** none intentionally left.

**Type consistency:** `PathSnapshot`, `ExtractableBoundsObject`, `getObjectsForSimulation`, `buildLaserPaths`, `EditorMode` names aligned across tasks.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-24-laser-editor.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — run tasks in this session with executing-plans checkpoints  

Which approach?
