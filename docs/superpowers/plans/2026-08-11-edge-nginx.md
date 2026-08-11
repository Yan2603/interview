# Edge Nginx 独立部署 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 interview 仓库用 Docker 容器 `edge-nginx` 独占宿主 `:80`，按路径反代到 `interview-nginx` 与（可选）`douban-web`；保留 interview 自有 nginx。

**Architecture:** `deploy/edge` 独立 compose；根 compose 的 nginx 改为 `expose` + `container_name: interview-nginx` + 外部网络 `edge-net`。

**Tech Stack:** Docker Compose、nginx:alpine、GitHub Actions（现有 SSH deploy）。

**Spec:** `docs/superpowers/specs/2026-08-11-edge-nginx-design.md`

## Global Constraints

- edge 归属 **interview** `deploy/edge/`，不 apt 安装 Nginx。
- **保留** interview-nginx（静态 + 反代 app）。
- 固定名：网络 `edge-net`；容器 `edge-nginx`、`interview-nginx`；douban 侧 `douban-web`。
- 本期不做 HTTPS、GHCR、去掉 interview-nginx。
- commit 英文 conventional；与 douban **分仓库**提交。

## 文件映射

| 路径 | 职责 |
|------|------|
| `deploy/edge/nginx.conf` | 路径分流反代 |
| `deploy/edge/docker-compose.yml` | edge 占宿主 80 |
| `docker-compose.yml` | nginx 去宿主 80；`container_name`；接 `edge-net` |
| `README.md` | 生产入口说明 |
| `.github/workflows/ci.yml` | 校验前建 `edge-net`；deploy 时同步 edge |

---

### Task 1: edge Nginx（容器）配置

**Files:**
- Create: `deploy/edge/nginx.conf`
- Create: `deploy/edge/docker-compose.yml`

**Interfaces:**
- Consumes: 运行中的 `interview-nginx:80`；可选 `douban-web:80`（同 `edge-net`）
- Produces: `edge-nginx` 映射宿主 `80:80`

- [ ] **Step 1: 创建 `deploy/edge/nginx.conf`**

```nginx
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    sendfile      on;
    keepalive_timeout 65;
    client_max_body_size 6m;

    # Docker embedded DNS — resolve at request time (douban optional)
    resolver 127.0.0.11 valid=10s ipv6=off;

    server {
        listen 80;
        server_name _;

        location /movie/ {
            set $douban_upstream douban-web:80;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_pass http://$douban_upstream;
        }

        location /api/ {
            set $interview_upstream interview-nginx:80;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_connect_timeout 60s;
            proxy_send_timeout 300s;
            proxy_read_timeout 300s;
            client_max_body_size 6m;
            proxy_pass http://$interview_upstream;
        }

        location /uploads/ {
            set $interview_upstream interview-nginx:80;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_pass http://$interview_upstream;
        }

        location / {
            set $interview_upstream interview-nginx:80;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_pass http://$interview_upstream;
        }
    }
}
```

说明：变量 + `resolver` 避免启动时解析 `douban-web` 失败；`proxy_pass http://$douban_upstream;`（无 URI 后缀）保留完整 `/movie/...`。

- [ ] **Step 2: 创建 `deploy/edge/docker-compose.yml`**

```yaml
services:
  edge:
    image: docker.m.daocloud.io/library/nginx:alpine
    container_name: edge-nginx
    restart: unless-stopped
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    networks:
      - edge-net

networks:
  edge-net:
    external: true
```

CI 校验可用官方 `nginx:alpine`；服务器默认 daocloud 镜像与根 compose 一致。若 CI 需官方镜像，可在 workflow `env` 覆盖，或本文件改用 `nginx:alpine` 并在服务器配镜像加速——实现时与现有 `NGINX_IMAGE` 习惯对齐即可。

推荐实现：与 `Dockerfile` 一样用 build-arg / 环境变量可选镜像；最小方案先写死 `nginx:alpine`（Actions 友好），服务器若拉不动再换成 daocloud 完整路径。

**采用：**

```yaml
    image: ${NGINX_IMAGE:-nginx:alpine}
```

- [ ] **Step 3: 语法检查**

```bash
docker network create edge-net || true
docker run --rm -v "${PWD}/deploy/edge/nginx.conf:/etc/nginx/nginx.conf:ro" nginx:alpine nginx -t
```

（Windows PowerShell 把 `${PWD}` 换成 `${PWD}` 或 `%cd%` 等价写法。）

Expected: `syntax is ok` / `test is successful`。

- [ ] **Step 4: Commit（interview）**

```bash
git add deploy/edge/nginx.conf deploy/edge/docker-compose.yml
git commit -m "chore: add edge nginx compose for host port 80 routing"
```

---

### Task 2: 根 compose 接入 edge-net

**Files:**
- Modify: `docker-compose.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: 外部网络 `edge-net`
- Produces: `container_name: interview-nginx`；不再映射宿主 `80`

- [ ] **Step 1: 修改 `docker-compose.yml` 的 nginx 服务**

```yaml
  nginx:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: interview-nginx
    restart: unless-stopped
    expose:
      - "80"
    depends_on:
      - app
    networks:
      - interview-net
      - edge-net
```

`networks:` 段：

```yaml
networks:
  interview-net:
    driver: bridge
  edge-net:
    external: true
```

**注意：** 服务器切换前必须已有 `edge-net`，且准备好启动 `deploy/edge`，否则去掉 `"80:80"` 后公网短暂不可访问。

- [ ] **Step 2: 更新 README 生产部署说明**

在「生产部署」段补充：

```markdown
生产入口由 **edge Nginx 容器**（`edge-nginx`，见 `deploy/edge/`）占用宿主 `:80`，按路径反代：
- `/`、`/api/`、`/uploads/` → `interview-nginx`
- `/movie/` → `douban-web`（同机 douban 时）

interview 的 nginx **不再**映射宿主 80，仅 `expose` 并加入外部网络 `edge-net`。

首次上线：
```bash
docker network create edge-net || true
docker compose up -d --build
docker compose -f deploy/edge/docker-compose.yml up -d
```
```

- [ ] **Step 3: Commit（interview）**

```bash
git add docker-compose.yml README.md
git commit -m "chore: expose nginx on edge-net instead of host port 80"
```

---

### Task 3: CI/CD 同步 edge

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: Task 1–2
- Produces: CI build 不因缺 `edge-net` 失败；deploy 后 edge 配置生效

- [ ] **Step 1: docker job 建网**

在 `docker compose build` 前增加：

```yaml
      - name: Create edge-net for compose validation
        run: docker network create edge-net || true
```

- [ ] **Step 2: deploy 脚本追加 edge up**

在 `docker compose up -d --build` 之后：

```bash
            docker compose -f deploy/edge/docker-compose.yml up -d
```

- [ ] **Step 3: Commit（interview）**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: create edge-net and restart edge-nginx on deploy"
```

---

### Task 4: 服务器切换（人工）

**Files:** 无；目标 ECS 执行

- [ ] **Step 1: 切换顺序**

```bash
docker network create edge-net || true
cd "$DEPLOY_PATH"   # interview clone
git fetch && git reset --hard origin/main   # 或当前默认分支
# 先 up 业务（nginx 已无 80）— 若当前仍占 80，本步会释放宿主 80
docker compose up -d --build
docker compose -f deploy/edge/docker-compose.yml up -d
# 若 douban 已 clone：
# cd /opt/douban-movie && docker compose up -d --build
```

- [ ] **Step 2: 冒烟**

| 检查 | Expected |
|------|----------|
| `curl -sI http://127.0.0.1/` | 200 |
| `curl -sI http://127.0.0.1/api/health` | 200 |
| `curl -sI http://127.0.0.1/movie/`（douban 已起） | 200 |

- [ ] **Step 3: 回滚预案（仅失败时）**

恢复根 compose nginx 的 `"80:80"`、去掉对 `edge-net` 的强制依赖（或先 `docker stop edge-nginx`），`docker compose up -d`。

---

## 自检（对照规格）

| 规格项 | 任务 |
|--------|------|
| edge 在 interview `deploy/edge/` | Task 1 |
| 保留 interview-nginx | Task 2（仅改端口/网络） |
| edge 独占宿主 80 | Task 1 |
| `edge-net` + 固定容器名 | Task 1–2 |
| CD 同步 edge | Task 3 |
| 上线 / 回滚 / 验收 | Task 4 |

容器名锁定：`edge-nginx`、`interview-nginx`（+ 同机 `douban-web`）；网络 `edge-net`。
