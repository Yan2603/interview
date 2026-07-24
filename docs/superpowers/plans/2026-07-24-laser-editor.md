# 激光画板（Fabric.js 双 Canvas）实现计划

> **面向代理式执行者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans，按任务逐步实现本计划。步骤使用复选框（`- [ ]`）语法跟踪进度。

**目标：** 新增 `/laser` 路由模块，包含 Fabric.js 设计画布 + 原生 Canvas 2D 预览，覆盖编辑/导入/导出以及有序路径模拟，用于面试练习。

**架构：** 全部激光相关代码位于 `packages/client/src/laser/`。设计层（Fabric）为唯一数据源；预览层仅消费 `PathSnapshot[]`。在 `edit` 与 `preview` 模式间切换，不持久化预览状态。

**技术栈：** Vue 3、Vite、Ant Design Vue、Fabric.js `6.6.1`、Vitest（沿用现有客户端测试运行器）。

## 全局约束

- 激光相关代码仅放在 `packages/client/src/laser/`（外加最小限度的路由/导航接线）。
- 设计画布：Fabric.js；预览画布：原生 Canvas 2D（不创建第二个 Fabric 实例）。
- 文件导入大小限制：**5MB**。
- 图片路径提取：**仅轴对齐包围盒**（不做光栅矢量化）。
- 无 G-code、无后端 API、无撤销/图层。
- 纯工具函数优先 TDD（`pathExtract`、导入校验、下载辅助）。
- 中文 UI 文案通过 Ant Design Vue `message` / 按钮标签呈现。

## 文件映射

| 路径 | 职责 |
|---|---|
| `packages/client/package.json` | 添加 `fabric@6.6.1` |
| `packages/client/src/laser/types.ts` | 共享类型 |
| `packages/client/src/laser/utils/pathExtract.ts` | 对象 → `PathSnapshot[]` |
| `packages/client/src/laser/utils/pathExtract.test.ts` | 单元测试 |
| `packages/client/src/laser/utils/export.ts` | SVG/JSON 下载辅助 |
| `packages/client/src/laser/utils/export.test.ts` | 单元测试 |
| `packages/client/src/laser/utils/import.ts` | 文件校验 + 加载辅助 |
| `packages/client/src/laser/utils/import.test.ts` | 单元测试 |
| `packages/client/src/laser/composables/useDesignCanvas.ts` | Fabric 生命周期 + 对象操作 |
| `packages/client/src/laser/composables/usePreviewCanvas.ts` | 在 2D 画布上播放路径 |
| `packages/client/src/laser/composables/useLaserPaths.ts` | 桥接：选中对象 → 快照 |
| `packages/client/src/laser/components/DesignCanvas.vue` | 设计画布宿主 |
| `packages/client/src/laser/components/PreviewCanvas.vue` | 预览画布宿主 |
| `packages/client/src/laser/components/LaserToolbar.vue` | 工具 / 导入 / 导出 / 模式 |
| `packages/client/src/laser/LaserEditorView.vue` | 页面壳 + 模式编排 |
| `packages/client/src/router/index.ts` | 添加 `/laser` 路由 |
| `packages/client/src/components/layout/AppLayout.vue` | 侧栏入口 + 选中 key |

---

### 任务 1：类型、依赖、路由与导航壳

**文件：**
- 修改：`packages/client/package.json`
- 新建：`packages/client/src/laser/types.ts`
- 新建：`packages/client/src/laser/LaserEditorView.vue`（占位页）
- 修改：`packages/client/src/router/index.ts`
- 修改：`packages/client/src/components/layout/AppLayout.vue`

**接口：**
- 消费：现有 Vue Router / AppLayout 菜单模式
- 产出：从 `types.ts` 导出 `EditorMode`、`PathSnapshot`、`ExportFormat`、`ExtractableBoundsObject`；路由 `/laser` 可从导航进入

- [ ] **步骤 1：安装 Fabric.js**

在仓库根目录执行：

```bash
pnpm --filter @interview/client add fabric@6.6.1
```

预期：`packages/client/package.json` 中列出 `"fabric": "6.6.1"`（或精确解析为 `6.6.1`）。

- [ ] **步骤 2：创建类型**

创建 `packages/client/src/laser/types.ts`：

```ts
export type EditorMode = 'edit' | 'preview';

export type ExportFormat = 'svg' | 'json';

export type PathSnapshot = {
  id: string;
  d: string;
  order: number;
  sourceObjectId?: string;
};

/** 轴对齐包围盒，已是画布坐标（含 Fabric 变换后）。 */
export type ExtractableBoundsObject = {
  id: string;
  type: string;
  bounds: { left: number; top: number; width: number; height: number };
};
```

- [ ] **步骤 3：占位视图 + 路由**

创建 `packages/client/src/laser/LaserEditorView.vue`：

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

在 `packages/client/src/router/index.ts` 中添加路由（与现有路由并列）：

```ts
{
  path: '/laser',
  component: () => import('../laser/LaserEditorView.vue'),
  meta: { title: '激光画板' },
},
```

- [ ] **步骤 4：侧栏导航入口**

在 `AppLayout.vue` 的 `mainSelectedKeys` 中：

```ts
const mainSelectedKeys = computed(() => {
  if (route.path.startsWith('/questions')) return ['questions'];
  if (route.path.startsWith('/calendar')) return ['calendar'];
  if (route.path.startsWith('/laser')) return ['laser'];
  return ['dashboard'];
});
```

在菜单模板中，日历项之后添加：

```vue
<a-menu-item key="laser">
  <router-link to="/laser">激光画板</router-link>
</a-menu-item>
```

- [ ] **步骤 5：路由冒烟检查**

运行：`pnpm --filter @interview/client dev`

打开 `http://localhost:5173/laser` — 占位标题可见；侧栏高亮「激光画板」。

- [ ] **步骤 6：提交**

```bash
git add packages/client/package.json packages/client/pnpm-lock.yaml pnpm-lock.yaml packages/client/src/laser/types.ts packages/client/src/laser/LaserEditorView.vue packages/client/src/router/index.ts packages/client/src/components/layout/AppLayout.vue
git commit -m "feat(laser): scaffold /laser route, types, and Fabric dependency"
```

（若 lockfile 仅存在于仓库根目录，则改用该路径。）

---

### 任务 2：路径提取（TDD）

**文件：**
- 新建：`packages/client/src/laser/utils/pathExtract.ts`
- 新建：`packages/client/src/laser/utils/pathExtract.test.ts`

**接口：**
- 消费：来自 `../types` 的 `ExtractableBoundsObject`、`PathSnapshot`
- 产出：
  - `boundsToPathD(bounds): string`
  - `extractPathsFromObjects(objects: ExtractableBoundsObject[]): PathSnapshot[]`

- [ ] **步骤 1：编写失败测试**

创建 `packages/client/src/laser/utils/pathExtract.test.ts`：

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

- [ ] **步骤 2：运行测试 — 预期失败**

```bash
pnpm --filter @interview/client test -- src/laser/utils/pathExtract.test.ts
```

预期：FAIL（模块未找到 / 导出缺失）。

- [ ] **步骤 3：实现**

创建 `packages/client/src/laser/utils/pathExtract.ts`：

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

- [ ] **步骤 4：运行测试 — 预期通过**

```bash
pnpm --filter @interview/client test -- src/laser/utils/pathExtract.test.ts
```

预期：PASS。

- [ ] **步骤 5：提交**

```bash
git add packages/client/src/laser/utils/pathExtract.ts packages/client/src/laser/utils/pathExtract.test.ts
git commit -m "feat(laser): add bounding-box path extraction utils"
```

---

### 任务 3：导入校验与导出下载辅助（TDD）

**文件：**
- 新建：`packages/client/src/laser/utils/import.ts`
- 新建：`packages/client/src/laser/utils/import.test.ts`
- 新建：`packages/client/src/laser/utils/export.ts`
- 新建：`packages/client/src/laser/utils/export.test.ts`

**接口：**
- 消费：不依赖 Fabric（纯函数）
- 产出：
  - `MAX_IMPORT_BYTES = 5 * 1024 * 1024`
  - `validateImportFile(file: { name: string; size: number; type: string }): { ok: true; kind: 'image' | 'svg' } | { ok: false; message: string }`
  - `readFileAsDataURL(file: File): Promise<string>`
  - `readFileAsText(file: File): Promise<string>`
  - `downloadTextFile(filename: string, content: string, mime: string): void`
  - `buildExportFilename(format: 'svg' | 'json'): string`

- [ ] **步骤 1：编写失败的导入测试**

创建 `packages/client/src/laser/utils/import.test.ts`：

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

- [ ] **步骤 2：编写失败的导出测试**

创建 `packages/client/src/laser/utils/export.test.ts`：

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

- [ ] **步骤 3：运行测试 — 预期失败**

```bash
pnpm --filter @interview/client test -- src/laser/utils/import.test.ts src/laser/utils/export.test.ts
```

预期：FAIL。

- [ ] **步骤 4：实现 import.ts**

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

- [ ] **步骤 5：实现 export.ts**

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

- [ ] **步骤 6：运行测试 — 预期通过**

```bash
pnpm --filter @interview/client test -- src/laser/utils/import.test.ts src/laser/utils/export.test.ts
```

预期：PASS。

- [ ] **步骤 7：提交**

```bash
git add packages/client/src/laser/utils/import.ts packages/client/src/laser/utils/import.test.ts packages/client/src/laser/utils/export.ts packages/client/src/laser/utils/export.test.ts
git commit -m "feat(laser): add import validation and export download helpers"
```

---

### 任务 4：设计画布 composable + 组件

**文件：**
- 新建：`packages/client/src/laser/composables/useDesignCanvas.ts`
- 新建：`packages/client/src/laser/components/DesignCanvas.vue`

**接口：**
- 消费：`fabric` Canvas API；导入/导出工具
- 产出 `useDesignCanvas(canvasEl: Ref<HTMLCanvasElement | null>)`，返回：
  - `ready: Ref<boolean>`
  - `selectedCount: Ref<number>`
  - `objectCount: Ref<number>`
  - `init(): void` / `dispose(): void`
  - `setLocked(locked: boolean): void`
  - `addRect()`、`addEllipse()`、`addLine()`、`addText()`
  - `deleteSelected()`、`clearAll()`
  - `importFile(file: File): Promise<void>`
  - `exportSvg(): string | null`、`exportJson(): string | null`
  - `getObjectsForSimulation(): ExtractableBoundsObject[]`

- [ ] **步骤 1：实现 `useDesignCanvas.ts`**

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

  /** 优先选中对象；若无选中则返回全部对象。 */
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

- [ ] **步骤 2：实现 `DesignCanvas.vue`**

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

- [ ] **步骤 3：提交**

```bash
git add packages/client/src/laser/composables/useDesignCanvas.ts packages/client/src/laser/components/DesignCanvas.vue
git commit -m "feat(laser): add Fabric design canvas composable and component"
```

---

### 任务 5：预览画布 + 路径桥接

**文件：**
- 新建：`packages/client/src/laser/composables/useLaserPaths.ts`
- 新建：`packages/client/src/laser/composables/usePreviewCanvas.ts`
- 新建：`packages/client/src/laser/components/PreviewCanvas.vue`

**接口：**
- 消费：`extractPathsFromObjects`、`PathSnapshot`、`ExtractableBoundsObject`
- 产出：
  - `useLaserPaths.ts` 中的 `buildLaserPaths(objects: ExtractableBoundsObject[]): PathSnapshot[]`（薄封装）
  - `usePreviewCanvas(canvasEl)`，含 `load(paths)`、`play()`、`pause()`、`reset()`、`clear()`、`dispose()`、`progress: Ref<number>`、`playing: Ref<boolean>`

- [ ] **步骤 1：实现 `useLaserPaths.ts`**

```ts
import type { ExtractableBoundsObject, PathSnapshot } from '../types';
import { extractPathsFromObjects } from '../utils/pathExtract';

export function buildLaserPaths(objects: ExtractableBoundsObject[]): PathSnapshot[] {
  return extractPathsFromObjects(objects);
}
```

- [ ] **步骤 2：实现 `usePreviewCanvas.ts`**

路径绘制策略：解析 `boundsToPathD` 生成的简单 `M x y H x2 V y2 H x Z` 矩形，用 `requestAnimationFrame` 逐步描边周长。

```ts
import { onBeforeUnmount, ref, type Ref } from 'vue';
import type { PathSnapshot } from '../types';

type Point = { x: number; y: number };

function rectPathToPoints(d: string): Point[] {
  // 期望格式：M L T H R V B H L Z（由 boundsToPathD 生成）
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

若实现时渐进描边逻辑过重，可简化：可接受的回退方案是**用定时器逐条完整绘制路径**（仍保持有序模拟）。优先采用上方 rAF 版本；若卡住超过 30 分钟，将 `frame()` 替换为每 400ms 顺序描完整路径。

- [ ] **步骤 3：实现 `PreviewCanvas.vue`**

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

- [ ] **步骤 4：提交**

```bash
git add packages/client/src/laser/composables/useLaserPaths.ts packages/client/src/laser/composables/usePreviewCanvas.ts packages/client/src/laser/components/PreviewCanvas.vue
git commit -m "feat(laser): add preview canvas path playback"
```

---

### 任务 6：工具栏 + 编辑器页面集成

**文件：**
- 新建：`packages/client/src/laser/components/LaserToolbar.vue`
- 修改：`packages/client/src/laser/LaserEditorView.vue`

**接口：**
- 消费：design/preview 暴露的方法；`buildLaserPaths`；`downloadTextFile` / `buildExportFilename`
- 产出：可用的 `/laser` 页面，含编辑 + 预览模式

- [ ] **步骤 1：实现 `LaserToolbar.vue`**

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

若 `a-upload` 包裹不便，可将导入控件替换为普通 `<input type="file">` + `a-button` 标签（不用 `a-upload`）。

- [ ] **步骤 2：重写 `LaserEditorView.vue`**

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

- [ ] **步骤 3：类型检查 / 单元测试**

```bash
pnpm --filter @interview/client test
pnpm --filter @interview/client exec vue-tsc -b --pretty false
```

预期：测试通过；修复任何 Fabric 6 类型不匹配（`FabricText` vs `IText`、`getBoundingRect()` 签名、`util.groupSVGElements`），直到 `vue-tsc` 干净。

- [ ] **步骤 4：手动验收**

运行 `pnpm --filter @interview/client dev` 并验证：

1. 添加矩形/椭圆/直线/文字；拖拽/缩放/旋转  
2. 删除选中；清空  
3. 导入 PNG 与 SVG（<5MB）；超限时用 message 拒绝  
4. 导出 SVG/JSON 可下载；空画布给出警告  
5. 选中对象 → 开始模拟 → 预览层按顺序动画  
6. 暂停 / 重播 / 退出模拟 后回到可编辑设计态  

- [ ] **步骤 5：提交**

```bash
git add packages/client/src/laser/components/LaserToolbar.vue packages/client/src/laser/LaserEditorView.vue
git commit -m "feat(laser): wire toolbar and dual-canvas editor page"
```

---

## 规格覆盖自检

| 规格要求 | 任务 |
|---|---|
| 统一 `src/laser/` 布局 | 1–6 |
| 路由 `/laser` + 导航 | 1 |
| Fabric 设计 + 原生 2D 预览 | 4–5 |
| 形状、文字、变换、删除、清空 | 4, 6 |
| 导入图片/SVG + 5MB 限制 | 3, 4, 6 |
| 导出 SVG/JSON + 空内容保护 | 3, 4, 6 |
| 选中 → 有序路径模拟 | 2, 5, 6 |
| 播放/暂停/重播/退出；预览时锁定设计 | 5, 6 |
| 图片 = 仅 bbox 路径 | 2, 4 |
| 纯工具函数单元测试 | 2, 3 |
| 卸载时 dispose | 4, 5 |

**占位符扫描：** 无故意遗留。

**类型一致性：** `PathSnapshot`、`ExtractableBoundsObject`、`getObjectsForSimulation`、`buildLaserPaths`、`EditorMode` 名称在各任务间对齐。

---

## 执行交接

计划已完成并保存至 `docs/superpowers/plans/2026-07-24-laser-editor.md`。

两种执行方式：

1. **子代理驱动（推荐）** — 每任务使用新子代理，任务间进行评审  
2. **本会话内联执行** — 在本会话按任务执行，配合 executing-plans 检查点  

采用哪种方式？
