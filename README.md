# 面试驾驶舱

个人面试备战指挥台：八股题库、面试日历、AI 参考答案。

## 技术栈

- 前端：Vue 3 + Vite + Ant Design Vue + Pinia
- 后端：NestJS + MongoDB
- AI：OpenAI-compatible API（默认通义 qwen-max）

## 本地开发

```bash
pnpm install           # 若提示 ignored builds，已在 pnpm-workspace.yaml 配置 allowBuilds
cp .env.example .env   # 配置 MONGODB_URI、AI_API_KEY、DATABASE_URL、MILVUS_URI 等

# 用 Docker 起依赖（映射到本机端口，供 pnpm 连接 localhost）
docker network create edge-net || true   # 根 compose 声明了 external edge-net
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d mongo postgres etcd minio milvus

pnpm dev               # 前端 :5173，后端 :3000
```

本机连接地址（与 `.env.example` 一致）：Mongo `localhost:27017`、Postgres `localhost:5432`、Milvus `localhost:19530`。

## 生产部署（云服务器）

生产入口由 **edge Nginx 容器**（`edge-nginx`，见 `deploy/edge/`）占用宿主 `:80`，按路径反代：

- `/`、`/api/`、`/uploads/` → `interview-nginx`
- `/movie/` → `douban-web`（同机 douban 时）

interview 的 nginx **不再**映射宿主 80，仅 `expose` 并加入外部网络 `edge-net`。

排障：响应头 `X-Request-Id`（全链路）、`X-Served-By`（如 `edge/interview`、`edge/douban`）；edge 日志含 `target=` 与 `upstream=`：

```bash
docker logs edge-nginx --tail 100
docker logs interview-nginx --tail 100
# 用同一 request id 在 app 日志中检索
```

```bash
cp .env.example .env   # 填写 AI_API_KEY 等（MONGODB_URI / DATABASE_URL / MILVUS_URI 由 compose 注入）
docker network create edge-net || true
# 镜像由 CI 推到 GHCR；服务器只 pull，不在机上 build
# 手动部署时需 export 或写入 .env：GHCR_IMAGE=yan2603/interview IMAGE_TAG=<sha|latest>
docker compose pull
docker compose up -d
docker compose -f deploy/edge/docker-compose.yml up -d
# 访问 http://<server-ip>
```

本地若要自己构建（不走 GHCR）：`docker compose up -d --build`。

生产 **不要** 带上 `docker-compose.dev.yml`，否则会把 Mongo/Postgres/Milvus 端口暴露到宿主机。

Docker 内服务互连使用 compose 服务名（`mongo` / `postgres` / `milvus`），**不要**在生产 `.env` 里写 `host.docker.internal`（Linux 云服务器无法解析该域名）。

### 自动部署（GitHub Actions）

push 到 `main` / `master`（或在 Actions 里手动 Run workflow）时会：lint/build → 构建并推送 `nginx`/`app` 镜像到 GHCR → SSH 到 ECS 执行 `git pull` + `docker compose pull` + `up -d`（**不在服务器 build**）+ `deploy/edge` up + `docker image prune -f`。

`GHCR_IMAGE` / `IMAGE_TAG` 由 Actions 在 SSH 会话里注入（`IMAGE_TAG`=`github.sha`），**不必**写进服务器 `.env`（与 douban-movie 相同）。仅在服务器上手动 `compose pull/up` 时才需要。

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
| `GHCR_TOKEN` | （可选）`read:packages` PAT；GHCR 包为 private 时服务器 pull 需要 |

Workflow 使用 Environment `production`：在 Settings → Environments 中创建同名环境即可（可先不加审批门禁）。

**3. 服务器前提**

- 已安装 Docker + Compose，仓库目录下 `.env` 已配置业务密钥（AI / JWT 等）
- `DEPLOY_PATH` 为 git clone 的仓库，且能 `git fetch` 到 GitHub
- 部署用公钥已写入该 SSH 用户的 `authorized_keys`
- 私有 GHCR 包需在服务器能 `docker login ghcr.io`（或配置 `GHCR_TOKEN`）

**4. 验证**

1. 配置完成后，Actions → deploy → Run workflow（选 `main`），或向 `main` 推送提交
2. 确认 `Docker build` 已 push 到 `ghcr.io/<owner>/interview/{nginx,app}`，`Deploy to server` 成功：SSH → pull → up → prune
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
