# Login Page Tech Aesthetic Design

日期：2026-08-07  
状态：已评审待实现

## 目标

优化登录页视觉，缓解「只有两个输入框」的单调感，增加**适中强度的科技感 / 深色驾驶舱氛围**，同时保持现有登录流程可用、不喧宾夺主。

## 决策摘要

| 项 | 选择 |
|----|------|
| 风格 | 深色驾驶舱风 |
| 点缀强度 | 适中（网格 + 漂移光斑 + 轻扫描线/边角装饰，2–3 个轻动画） |
| 品牌露出 | 弱露出：卡片角落小字「面试驾驶舱」，主标题仍为「登录」 |
| 实现路径 | 纯 CSS 氛围层，仅改 `LoginView.vue` |

## 非目标（本期不做）

- Canvas / 粒子系统
- 全局深色主题或登录后后台改色
- 改 auth 逻辑、API、路由守卫
- 新增 npm 依赖
- 强品牌 hero 文案或左右分栏营销布局

## 视觉设计

### 背景

- 近黑深蓝底：约 `#070b14` → `#0d1526` 径向/线性渐变
- 低透明度细网格（CSS `linear-gradient` 叠加）
- 2 个柔和青蓝光斑缓慢漂移（`opacity` 低，避免紫光、重发光）
- 一条极淡水平扫描线缓缓下移

### 登录卡片

- 居中，最大宽度约 360px（与现有一致）
- 半透明深色毛玻璃：`backdrop-filter: blur(...)` + 半透明填充
- 细亮边（低对比描边）
- 四角短线装饰（CSS `::before` / `::after` 或绝对定位伪元素/子元素）
- 标题：「登录」
- 品牌：小字「面试驾驶舱」置于卡片底部或右上角（弱露出）

### 表单控件

- 继续使用 Ant Design Vue：`a-form` / `a-input` / `a-input-password` / `a-button`
- scoped CSS 深色适配：深底输入框、亮边、浅色标签文字
- 主按钮色：青蓝约 `#2f6fed`（对齐现有 Ant 主色倾向，避免紫色）

### 动效（恰好约 3 个）

1. 光斑缓慢漂移
2. 扫描线下移
3. 卡片边框轻微呼吸（opacity / border-color）

`prefers-reduced-motion: reduce` 时关闭上述动画，静态展示背景与卡片即可。

## 交互与行为

- 校验、提交、`auth.login`、redirect、`message` 错误提示**全部保持现状**
- 装饰层：`pointer-events: none` + `aria-hidden="true"`，不拦截点击与键盘
- 小屏：仍居中单卡；装饰可减弱但不遮挡输入

## 实现范围

**只改** `packages/client/src/views/LoginView.vue`：

1. template：在 `.login-page` 内增加装饰层 DOM（网格/光斑/扫描线），卡片内加角标与弱品牌文案；可去掉 `a-card` 的默认 `title` 改用自定义标题区以便深色样式，或保留 `a-card` 并用深度选择器覆盖
2. style：替换灰底为驾驶舱氛围；深色卡片与表单微调；keyframes + reduced-motion

**不改**：`authStore`、后端 auth、`App.vue` 路由外壳（登录已是 standalone `RouterView`）、其他页面主题。

## 验收标准

- `/login` 深色氛围清晰，网格与光斑可见但不抢眼
- 表单可读、可提交，登录成功/失败行为与改前一致
- 品牌「面试驾驶舱」以小字出现，不压过「登录」
- 开系统「减少动态效果」时无持续动画
- 无新增依赖；改动文件限于 `LoginView.vue`（本设计文档除外）

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| Ant Design 控件在深色底上对比不足 | scoped 覆盖输入/标签/边框颜色，实机检查 |
| `backdrop-filter` 个别浏览器弱 | 半透明填充兜底，无滤镜时仍可读 |
| 动画引起眩晕或不适 | `prefers-reduced-motion` 关闭动画 |
