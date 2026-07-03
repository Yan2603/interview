# 面试驾驶舱

个人面试备战指挥台：八股题库、面试日历、AI 参考答案。

## 技术栈

- 前端：Vue 3 + Vite + Ant Design Vue + Pinia
- 后端：NestJS + MongoDB
- AI：OpenAI-compatible API（默认通义 qwen-max）

## 本地开发

```bash
pnpm install           # 若提示 ignored builds，已在 pnpm-workspace.yaml 配置 allowBuilds
cp .env.example .env   # 配置 MONGODB_URI、AI_API_KEY

# 需本地 MongoDB 运行中
pnpm dev               # 前端 :5173，后端 :3000
```

## 生产部署（云服务器）

```bash
cp .env.example .env   # 填写 AI_API_KEY 等
docker compose up -d --build
# 访问 http://<server-ip>:3000
```

生产模式下 NestJS 同时托管前端静态资源与 `/api`。

## 功能

- **概览**：题库掌握度统计、近 7 天面试
- **题库**：按分类浏览八股题，支持搜索、笔记、掌握度
- **AI 作答**：一键生成 / 加深版参考答案
- **日历**：月视图管理面试安排，面后复盘笔记

首次启动会自动 seed 分类与示例题目。

## 环境变量

| 变量 | 说明 |
|------|------|
| `MONGODB_URI` | MongoDB 连接串 |
| `AI_API_KEY` | 通义 / OpenAI-compatible API Key |
| `AI_BASE_URL` | 默认通义 compatible endpoint |
| `AI_MODEL` | 默认 `qwen-max` |

## 备注

- 开发时前端 `http://localhost:5173`，API 通过 Vite 代理到 `:3000`
- 生产单容器同时提供页面与 `/api`，访问 `:3000` 即可
- 站点无登录，请勿公开 URL
