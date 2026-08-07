# Login Page Tech Aesthetic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 `/login` 加上深色驾驶舱氛围（网格、漂移光斑、扫描线、毛玻璃卡片、弱品牌露出），不改登录逻辑。

**Architecture:** 仅改 `LoginView.vue`：在页面内加纯 CSS 装饰层（`pointer-events: none`），用自定义卡片头替代 `a-card` 默认 title 以便深色样式；Ant Design 表单控件保留，scoped + `:deep()` 做深色适配；三条 `@keyframes` + `prefers-reduced-motion`。

**Tech Stack:** Vue 3、Ant Design Vue、scoped CSS（无新依赖）。

## Global Constraints

- 设计文档：`docs/superpowers/specs/2026-08-07-login-tech-aesthetic-design.md`（已确认）。
- 只改 `packages/client/src/views/LoginView.vue`（外加本计划文档）。
- 不改 `authStore`、API、路由、`App.vue`、登录后主题。
- 不新增 npm 依赖；不做 Canvas/粒子。
- 品牌弱露出：小字「面试驾驶舱」；主标题「登录」。
- 主色青蓝约 `#2f6fed`；避免紫色、重发光。
- 装饰层必须 `aria-hidden="true"` 且 `pointer-events: none`。
- `prefers-reduced-motion: reduce` 时关闭光斑/扫描线/边框呼吸动画。
- 脚本逻辑（`onSubmit` / `loading` / form）保持行为不变。
- 用户可见文案中文；commit message 英文 conventional commits。

## 文件映射

| 路径 | 职责 |
|------|------|
| `packages/client/src/views/LoginView.vue` | 登录页 UI：装饰层 + 深色卡片 + 表单（逻辑不动） |

---

### Task 1: 模板结构 — 装饰层 + 自定义卡片壳

**Files:**
- Modify: `packages/client/src/views/LoginView.vue`

**Interfaces:**
- Consumes: 现有 `form` / `loading` / `onSubmit`（签名不变）
- Produces: DOM 类名约定供 Task 2 样式绑定：
  - `.login-page` > `.login-atmosphere`（含 `.login-grid`、`.login-orb.login-orb--a`、`.login-orb.login-orb--b`、`.login-scan`）
  - `.login-card`（不再用 `a-card` 的 `title` prop）> `.login-card__corners`、`.login-card__header`、`.login-card__brand`、表单

- [ ] **Step 1: 确认当前文件基线**

Read `packages/client/src/views/LoginView.vue`。确认 `<script setup>` 含 `onSubmit`、`form`、`loading`，且 template 仍为灰底 + `a-card title="登录"`。

- [ ] **Step 2: 替换 `<template>`（不改 script）**

将整个 `<template>...</template>` 替换为：

```vue
<template>
  <div class="login-page">
    <div class="login-atmosphere" aria-hidden="true">
      <div class="login-grid" />
      <div class="login-orb login-orb--a" />
      <div class="login-orb login-orb--b" />
      <div class="login-scan" />
    </div>

    <a-card class="login-card" :bordered="false">
      <div class="login-card__corners" aria-hidden="true" />
      <div class="login-card__header">
        <h1 class="login-card__title">登录</h1>
        <p class="login-card__brand">面试驾驶舱</p>
      </div>

      <a-form :model="form" layout="vertical" @finish="onSubmit">
        <a-form-item
          label="用户名"
          name="username"
          :rules="[{ required: true, message: '请输入用户名' }]"
        >
          <a-input
            v-model:value="form.username"
            autocomplete="username"
            placeholder="用户名"
            allow-clear
          />
        </a-form-item>
        <a-form-item
          label="密码"
          name="password"
          :rules="[{ required: true, message: '请输入密码' }]"
        >
          <a-input-password
            v-model:value="form.password"
            autocomplete="current-password"
            placeholder="密码"
          />
        </a-form-item>
        <a-form-item>
          <a-button type="primary" html-type="submit" block :loading="loading">
            登录
          </a-button>
        </a-form-item>
      </a-form>
    </a-card>
  </div>
</template>
```

- [ ] **Step 3: 冒烟检查 DOM 结构**

Run（需前端已在跑；若未启动：`pnpm dev:client`）：

打开 `http://localhost:5173/login`，DevTools 确认存在 `.login-atmosphere`、`.login-orb--a`、`.login-orb--b`、`.login-scan`、`.login-card__brand`，且页面仍可聚焦用户名输入框。

Expected: 结构齐全；样式尚未美化时可仍偏浅/破版，但表单可交互。

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/views/LoginView.vue
git commit -m "feat(client): restructure login template for cockpit chrome"
```

---

### Task 2: 驾驶舱样式 — 背景、毛玻璃、表单深色、动效

**Files:**
- Modify: `packages/client/src/views/LoginView.vue`（`<style scoped>`）

**Interfaces:**
- Consumes: Task 1 的类名约定
- Produces: 完整视觉验收通过的登录页

- [ ] **Step 1: 替换整个 `<style scoped>` 块**

将现有 `<style scoped>...</style>` 替换为：

```vue
<style scoped>
.login-page {
  --login-bg-0: #070b14;
  --login-bg-1: #0d1526;
  --login-accent: #2f6fed;
  --login-accent-soft: rgba(47, 111, 237, 0.35);
  --login-text: rgba(235, 240, 255, 0.92);
  --login-muted: rgba(180, 195, 230, 0.55);
  --login-border: rgba(140, 170, 255, 0.28);

  position: relative;
  isolation: isolate;
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow: hidden;
  background:
    radial-gradient(120% 80% at 50% -10%, #132038 0%, transparent 55%),
    linear-gradient(160deg, var(--login-bg-0), var(--login-bg-1));
  color: var(--login-text);
}

.login-atmosphere {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.login-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(120, 160, 255, 0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(120, 160, 255, 0.07) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%);
  opacity: 0.7;
}

.login-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(40px);
  opacity: 0.45;
}

.login-orb--a {
  width: 280px;
  height: 280px;
  left: 8%;
  top: 18%;
  background: radial-gradient(circle, rgba(47, 111, 237, 0.55), transparent 70%);
  animation: login-orb-a 18s ease-in-out infinite alternate;
}

.login-orb--b {
  width: 320px;
  height: 320px;
  right: 6%;
  bottom: 10%;
  background: radial-gradient(circle, rgba(56, 189, 248, 0.35), transparent 70%);
  animation: login-orb-b 22s ease-in-out infinite alternate;
}

.login-scan {
  position: absolute;
  left: 0;
  right: 0;
  height: 120px;
  top: -120px;
  background: linear-gradient(
    to bottom,
    transparent,
    rgba(120, 170, 255, 0.06),
    transparent
  );
  animation: login-scan 9s linear infinite;
}

.login-card {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 360px;
  background: rgba(12, 18, 32, 0.72) !important;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--login-border) !important;
  border-radius: 12px;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.03) inset,
    0 20px 50px rgba(0, 0, 0, 0.45);
  animation: login-card-breathe 4.5s ease-in-out infinite;
}

.login-card :deep(.ant-card-body) {
  padding: 28px 24px 22px;
}

.login-card__corners {
  pointer-events: none;
  position: absolute;
  inset: 10px;
}

.login-card__corners::before,
.login-card__corners::after {
  content: '';
  position: absolute;
  width: 14px;
  height: 14px;
  border-color: rgba(140, 180, 255, 0.55);
  border-style: solid;
}

.login-card__corners::before {
  top: 0;
  left: 0;
  border-width: 1px 0 0 1px;
}

.login-card__corners::after {
  top: 0;
  right: 0;
  border-width: 1px 1px 0 0;
}

.login-card__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(140, 170, 255, 0.16);
}

.login-card__title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--login-text);
}

.login-card__brand {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--login-muted);
  white-space: nowrap;
}

.login-card :deep(.ant-form-item-label > label) {
  color: rgba(210, 220, 245, 0.88);
}

.login-card :deep(.ant-input-affix-wrapper),
.login-card :deep(.ant-input) {
  background: rgba(6, 10, 20, 0.65);
  border-color: rgba(120, 150, 210, 0.35);
  color: var(--login-text);
}

.login-card :deep(.ant-input-affix-wrapper:hover),
.login-card :deep(.ant-input:hover),
.login-card :deep(.ant-input-affix-wrapper-focused),
.login-card :deep(.ant-input:focus) {
  border-color: var(--login-accent);
  box-shadow: 0 0 0 2px var(--login-accent-soft);
}

.login-card :deep(.ant-input::placeholder) {
  color: rgba(160, 175, 210, 0.45);
}

.login-card :deep(.ant-input-password-icon),
.login-card :deep(.ant-input-clear-icon) {
  color: rgba(180, 195, 230, 0.65);
}

.login-card :deep(.ant-btn-primary) {
  background: var(--login-accent);
  border-color: var(--login-accent);
  height: 40px;
  font-weight: 500;
}

.login-card :deep(.ant-btn-primary:hover) {
  background: #3d7cf5;
  border-color: #3d7cf5;
}

.login-card :deep(.ant-form-item-explain-error) {
  color: #ff8e8e;
}

@keyframes login-orb-a {
  from {
    transform: translate(0, 0);
  }
  to {
    transform: translate(36px, 28px);
  }
}

@keyframes login-orb-b {
  from {
    transform: translate(0, 0);
  }
  to {
    transform: translate(-42px, -24px);
  }
}

@keyframes login-scan {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(calc(100vh + 120px));
  }
}

@keyframes login-card-breathe {
  0%,
  100% {
    border-color: rgba(140, 170, 255, 0.28);
  }
  50% {
    border-color: rgba(140, 170, 255, 0.48);
  }
}

@media (prefers-reduced-motion: reduce) {
  .login-orb--a,
  .login-orb--b,
  .login-scan,
  .login-card {
    animation: none;
  }
}

@media (max-width: 480px) {
  .login-orb {
    opacity: 0.28;
  }

  .login-card__header {
    flex-wrap: wrap;
  }
}
</style>
```

- [ ] **Step 2: 视觉验收**

打开 `http://localhost:5173/login`，核对：

1. 深色渐变底 + 可见网格 + 两个柔和光斑在缓慢移动  
2. 一条淡扫描线缓慢下移  
3. 卡片半透明毛玻璃、四角短线、标题「登录」+ 右上/同行小字「面试驾驶舱」  
4. 输入框/按钮深色可读，主按钮为青蓝  
5. 故意输错密码：仍有错误 toast，不白屏  
6. 正确账号可登录并跳转（与改前一致）

- [ ] **Step 3: 减少动态效果验收**

Chrome DevTools → Rendering → Emulate CSS media feature `prefers-reduced-motion: reduce`。

Expected: 光斑、扫描线、卡片边框呼吸停止；页面仍为深色静态布局且可用。

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/views/LoginView.vue
git commit -m "feat(client): add dark cockpit aesthetic to login page"
```

---

## Spec coverage checklist

| Spec 要求 | Task |
|-----------|------|
| 深色驾驶舱底 + 网格 | Task 2 |
| 2 光斑漂移 | Task 2 |
| 扫描线 | Task 2 |
| 毛玻璃卡片 + 亮边 + 角标 | Task 1 DOM + Task 2 CSS |
| 弱品牌「面试驾驶舱」 | Task 1 |
| Ant Design 表单保留 + 深色适配 | Task 1–2 |
| 主色 `#2f6fed` | Task 2 |
| 3 动效 + `prefers-reduced-motion` | Task 2 |
| 装饰不挡交互 | Task 1 `aria-hidden` + Task 2 `pointer-events` |
| 逻辑/文件范围不变 | Global + Task 1 不改 script |

## Self-review notes

- 无 TBD/占位步骤；完整 CSS/template 已内联。
- 类名在 Task 1 / Task 2 一致。
- 纯视觉改动无单元测试；以浏览器冒烟 + reduced-motion 模拟代替 TDD。
