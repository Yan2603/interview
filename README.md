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
cp .env.example .env   # 填写 AI_API_KEY 等（MONGODB_URI 无需改，compose 会注入 mongo 服务地址）
docker compose up -d --build
# 访问 http://<server-ip>  （Nginx :80 反代 /api 到后端）
```

Docker 内 MongoDB 使用 compose 服务名 `mongo`，**不要**在 `.env` 里写 `host.docker.internal`（Linux 云服务器无法解析该域名）。

### 自动部署（GitHub Actions）

push 到 `main` / `master`（或在 Actions 里手动 Run workflow）时会：lint/build → 校验 Docker 构建 → SSH 到 ECS 执行 `git pull` + `docker compose up -d --build` + `docker image prune -f`。

部署默认关闭，需先完成以下配置。

**1. 仓库 Variable**（Settings → Secrets and variables → Actions → Variables）

| 名称 | 值 |
|------|-----|
| `DEPLOY_ENABLED` | `true` |

**2. 仓库 Secrets**

| 名称 | 含义 |
|------|------|
| `DEPLOY_HOST` | ECS 公网 IP 或域名 |
| `DEPLOY_USER` | SSH 用户（如 `root`） |
| `DEPLOY_SSH_KEY` | 私钥全文（对应服务器已授权的公钥） |
| `DEPLOY_PORT` | SSH 端口（默认 `22`） |
| `DEPLOY_PATH` | 服务器上仓库绝对路径（如 `/root/interview`） |

Workflow 使用 Environment `production`：在 Settings → Environments 中创建同名环境即可（可先不加审批门禁）。

**3. 服务器前提**

- 已安装 Docker + Compose，仓库目录下 `.env` 已配置
- `DEPLOY_PATH` 为 git clone 的仓库，且能 `git fetch` 到 GitHub
- 部署用公钥已写入该 SSH 用户的 `authorized_keys`

**4. 验证**

1. 配置完成后，Actions → CI → Run workflow（选 `main`），或向 `main` 推送提交
2. 确认 `Deploy to server` job 成功：SSH → compose 重建 → prune
3. 浏览器访问站点；服务器上 `docker images` 应无多余的 `<none>` 悬空镜像

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
