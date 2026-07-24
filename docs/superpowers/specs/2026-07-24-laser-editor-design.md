# 激光雕刻画板（Fabric.js 双 Canvas）设计

**日期：** 2026-07-24  
**状态：** 已确认  
**目标：** 在面试驾驶舱中新增可演示的激光雕刻前端模块，用 Fabric.js 快速覆盖岗位常见能力（画板编辑、导入导出、路径预览模拟），便于面试讲解。

## 背景与目标

目标公司为激光雕刻相关前端岗位，需要 Fabric.js / Canvas 图形编辑经验。本模块作为现有 Vue 3 应用的一个路由页面，一期做齐：

1. **画板编辑**：文字/图形，拖拽缩放旋转，导出 SVG / JSON  
2. **导入预览**：上传图片 / SVG，在设计层展示（矢量尽量可编辑）  
3. **雕刻模拟**：选区（或整画布）提取路径，按顺序在独立预览层播放示意  

**非目标（一期不做）：** 真实 G-code、功率/速度真机参数、材料库、撤销重做、图层面板、后端存稿、复杂栅格矢量化。

## 架构

采用 **双 Canvas** 方案：

| 层 | 技术 | 职责 |
|---|---|---|
| 设计层 | Fabric.js Canvas | 编辑、导入、选区；唯一几何真相源 |
| 预览层 | 裸 Canvas 2D（不用第二套 Fabric） | 只读路径顺序播放；不回写设计层 |

**模式：**

- `edit`：设计层可交互；预览层隐藏或仅作背景  
- `preview`：从设计层生成路径快照后锁定设计层；预览层置顶播放  

**路由：** `/laser` → `LaserEditorView.vue`，并在侧栏增加入口。

**代码组织：** 激光相关代码统一放在 `packages/client/src/laser/`，目录内再分层：

```
packages/client/src/laser/
  LaserEditorView.vue
  components/
    DesignCanvas.vue
    PreviewCanvas.vue
    LaserToolbar.vue
  composables/
    useDesignCanvas.ts
    usePreviewCanvas.ts
    useLaserPaths.ts
  utils/
    export.ts
    import.ts
    pathExtract.ts
  types.ts
```

路由仅增加对该 View 的引用；不把激光逻辑散落到全局 `components/` / `composables/`。

## 功能与交互

### 编辑模式

- 添加工具：矩形、椭圆、直线、文字  
- 选中对象：拖拽 / 缩放 / 旋转（Fabric 默认控件）  
- 删除选中、清空画布  
- 导入：图片（栅格上画布）、SVG（`loadSVGFromString`，尽量可编辑）  
- 导出：整画布 SVG、Fabric JSON  
- 选区：框选或多选；「开始模拟」针对当前选中，无选中则整画布  

### 预览 / 模拟模式

- 进入时提取有序路径快照，锁定设计层  
- 按对象顺序描边路径动画（示意激光走向）  
- 控制：播放 / 暂停 / 重播 / 退出回编辑  

### 布局

- 顶栏：工具 + 导入导出 + 模式切换  
- 中部：同尺寸双 canvas 叠放工作区  
- 状态信息保持极简（模式、选中数、模拟进度可选）  

## 数据流

```
用户操作
  → useDesignCanvas（Fabric 设计层）
  →「开始模拟」→ useLaserPaths 生成 PathSnapshot[]
  → usePreviewCanvas 播放；设计层锁定
  → 退出模拟：停动画、清预览层、解锁设计层；丢弃本次快照（不持久化预览态）
```

**约定：**

- 设计层是唯一真相源；预览层只消费快照  
- `edit → preview`：至少成功生成 1 条路径，否则提示并留在编辑  
- `preview → edit`：停止动画并清理预览层  

**类型（示意）：**

```ts
type EditorMode = 'edit' | 'preview'

type PathSnapshot = {
  id: string
  d: string
  order: number
  sourceObjectId?: string
}

type ExportFormat = 'svg' | 'json'
```

**路径提取策略：**

- 矢量对象（Rect / Ellipse / Line / Text 等）：用轮廓或等价 path，归一化到工作区坐标  
- 图片：一期仅用**边界框 / 简化轮廓示意**；面试可说明未做栅格矢量化的原因与后续方向  

## 错误处理

- 导入格式错误或损坏：提示，画布不变  
- 文件过大（上限 5MB）：拒绝并提示  
- 空画布导出：提示无可导出内容  
- 无对象或路径提取为空时开始模拟：提示并留在编辑  
- Canvas：`onMounted` + `nextTick` 初始化；卸载时 `dispose`；路由离开时停动画  

## 测试与成功标准

**测试：**

- 单测优先纯函数：`pathExtract`、可脱离 DOM 的 import/export 辅助  
- 不做强制 E2E；手动验收：添加/变换、导入导出、选区模拟播放/暂停/退出  

**成功标准：**

- 能完整演示编辑 + 导入导出 + 双层路径模拟  
- 能讲清双 Canvas 职责、真相源、图片路径示意的取舍  

## 依赖

- 前端增加 `fabric`（Fabric.js）依赖，版本在实现计划中锁定  
- 无新增后端接口  

## 已确认决策摘要

| 项 | 决策 |
|---|---|
| 库 | Fabric.js |
| 放置 | 现有 client 路由模块，统一目录 `src/laser/` |
| 栈 | Vue 3 + Vite（沿用本仓） |
| 范围 | 一期 A+B+C 全做 |
| 架构 | 双 Canvas（设计 + 预览） |
| 模拟深度 | 选区 + 路径/顺序示意，非 G-code |
