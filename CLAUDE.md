# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此代码库中工作时提供指导。

## 项目概述

面试驾驶舱 — 一个基于 monorepo 架构的面试备战 Web 应用，整合了八股题库管理、面试日历安排和 AI 生成参考答案功能。

**技术栈：**
- 前端：Vue 3 + Vite + Ant Design Vue + Pinia
- 后端：NestJS + MongoDB + Mongoose
- AI：OpenAI 兼容 API（默认：通义 qwen-max，通过 LangChain 调用）
- Monorepo：pnpm workspaces

## 开发命令

```bash
# 安装依赖
pnpm install

# 同时启动前后端（并行模式）
pnpm dev

# 单独启动服务
pnpm dev:server    # 仅后端（端口 3000）
pnpm dev:client    # 仅前端（端口 5173）

# 生产构建
pnpm build         # 构建前后端
pnpm build:server  # 仅构建后端
pnpm build:client  # 仅构建前端

# 生产启动（需先构建）
pnpm start:prod
```

## 环境配置

复制 `.env.example` 为 `.env` 并配置以下变量：
- `MONGODB_URI` — MongoDB 连接串（默认：`mongodb://localhost:27017/interview`）
- `AI_API_KEY` — 通义/OpenAI API 密钥（AI 作答功能必需）
- `AI_BASE_URL` — API 端点（默认为通义兼容端点）
- `AI_MODEL` — 模型名称（默认：`qwen-max`）

**开发环境：** 需要本地 MongoDB 运行。前端通过 Vite 配置将 `/api` 请求代理到后端。

**生产环境（Docker）：** 使用 `docker compose up -d --build`。Nginx 提供前端静态文件并代理 `/api` 到后端。MongoDB 作为 compose 服务运行，服务名为 `mongo`。

## 架构

### Monorepo 结构

```
packages/
├── client/           # Vue 3 单页应用
│   ├── src/
│   │   ├── views/        # 页面组件（概览、题库、日历、详情页）
│   │   ├── components/   # 可复用 Vue 组件
│   │   ├── api/          # Axios API 客户端
│   │   ├── router/       # Vue Router 配置
│   │   ├── types/        # TypeScript 类型定义
│   │   └── utils/        # 工具函数（Markdown 渲染、Mermaid 支持）
│   └── vite.config.ts
│
└── server/           # NestJS API
    ├── src/
    │   ├── categories/   # 题目分类（Vue3、性能优化等）
    │   ├── questions/    # 题目 CRUD + Schema
    │   ├── events/       # 面试日历事件
    │   ├── ai/           # AI 答案生成（LangChain + OpenAI 兼容）
    │   ├── dashboard/    # 统计数据聚合
    │   ├── tags/         # 标签管理
    │   ├── seed/         # 初始数据填充（模块初始化时运行）
    │   ├── health/       # 健康检查端点
    │   ├── common/       # 中间件（访问日志、异常过滤器）
    │   ├── config/       # Winston 日志配置
    │   └── main.ts       # 启动入口（CORS、全局前缀 `/api`、验证管道）
    └── nest-cli.json
```

### 关键后端模块

**Questions 模块** (`packages/server/src/questions/`)
- Schema：`title`（标题）、`content`（内容）、`categorySlug`（分类）、`tags[]`（标签）、`notes`（笔记）、`masteryLevel`（掌握度 0-2）、`aiAnswer`（AI 答案）
- Controller：CRUD 端点，通过 query 参数支持分页
- Service：查询构建、删除操作

**AI 模块** (`packages/server/src/ai/`)
- `AiService.generateAnswer(questionId, mode)` — 使用分类特定的 system prompt 调用 LangChain
- 两种模式：`standard`（3-5 分钟口述版答案）、`deep`（深入版，含示例、边界情况）
- Controller：同时提供 GET 和 POST `/api/questions/:id/ai-answer?mode=standard|deep`（拆分以避免 404）
- 限流：每个端点 10 请求/60 秒

**Seed 模块** (`packages/server/src/seed/`)
- 在 `OnModuleInit` 时运行，为空数据库填充默认分类和示例题目
- 填充 7 个分类：Vue3、性能优化、浏览器原理、网络、工程化、TypeScript、项目深挖

**日志配置** (`packages/server/src/config/winston.config.ts`)
- 开发环境：通过 nest-winston 输出彩色控制台日志
- 生产环境：JSON 格式日志写入 `logs/combined.log`、`logs/error.log`，支持轮转（10MB，保留 7-14 天）

### 前端架构

**路由** (`packages/client/src/router/index.ts`)
- `/` — 概览（统计、近期面试）
- `/questions` — 题目列表（带筛选）
- `/questions/:id` — 题目详情（笔记、AI 答案、掌握度、删除）
- `/calendar` — 面试日历（月视图）
- `/calendar/:id` — 面试详情

**关键视图：**
- `QuestionsView.vue` — 服务端分页、分类/标签筛选、搜索、掌握度徽章
- `QuestionDetailView.vue` — Markdown 渲染（通过 `marked`）、Mermaid 流程图支持、AI 答案生成 UI
- `CalendarView.vue` — 月度日历网格及事件单元格
- `DashboardView.vue` — 掌握度统计、即将到来的面试

**API 层** (`packages/client/src/api/`)
- Axios 实例，base path 为 `/api`
- 通过 `types/` 中的 TypeScript 接口实现类型安全的请求/响应

**Markdown 与 Mermaid** (`packages/client/src/utils/`)
- 使用 `marked` 解析 Markdown，`DOMPurify` 进行 XSS 清理
- AI 答案中的 Mermaid 流程图自动渲染

## 重要说明

- **环境文件位置：** 开发时后端从 monorepo 根目录读取 `.env`（通过 `app.module.ts` 中的 `rootEnvPath` 处理）
- **CORS：** 后端允许 `ALLOWED_ORIGINS`（开发默认：`http://localhost:5173`）
- **API 前缀：** 所有后端路由统一前缀 `/api`（在 `main.ts` 中设置）
- **限流：** 全局限流 100 请求/60 秒，AI 端点更严格为 10 请求/60 秒
- **生产静态文件服务：** 后端从 `dist/public` 提供构建后的前端，排除 `/api*` 路径
- **Docker 注意事项：** Linux 云服务器上请勿使用 `host.docker.internal` 连接 MongoDB — 使用 compose 服务名 `mongo`
- **数据填充：** 首次启动时若数据库为空会自动填充
- **无身份认证：** 应用无登录系统 — 请勿公开部署

## AI 答案生成流程

1. 前端调用 `POST /api/questions/:id/ai-answer?mode=standard|deep`
2. 后端从 MongoDB 获取题目
3. `AiService` 通过 `getSystemPrompt(categorySlug)` 构建分类特定的 system prompt
4. LangChain 调用 OpenAI 兼容 API（默认通义）
5. 生成的答案保存到 `question.aiAnswer` 字段
6. 前端渲染 Markdown 并支持 Mermaid

## Pnpm Workspace 配置

`pnpm-workspace.yaml` 包含需要原生构建的包的 `allowBuilds` 配置：
- `@nestjs/core`、`core-js`、`esbuild`、`vue-demi`

如果看到 "ignored builds" 警告，这些已经配置好，属于预期行为。
