# Edge Nginx 独立部署设计

日期：2026-08-11  
状态：已确认；实现计划见 `docs/superpowers/plans/2026-08-11-edge-nginx.md`  
工程：`interview`（宿主入口）+ 同机 `douban-movie`（路径 `/movie/`）

## 目标

把公网入口 **edge Nginx** 从业务 compose 中拆出，以 **Docker 容器** 跑在宿主机上，独占 `:80`，按路径反代到各应用容器；**保留** interview 自有 nginx（静态 SPA + 反代 `app`）。

## 已锁定决策

| 主题 | 选择 |
|------|------|
| edge 归属仓库 | **`interview`**（`deploy/edge/`），非 douban、非 apt 安装 |
| interview 自有 nginx | **保留**；继续服务静态与 `/api`、`/uploads` 反代 |
| 宿主端口 | 仅 `edge-nginx` 映射 `80:80`；interview-nginx / douban-web 仅 `expose` |
| 共享网络 | 外部网络 `edge-net`；跨 compose DNS 靠固定 `container_name` |
| 构建位置 | 仍在服务器 `compose up --build`；edge 用官方 `nginx:alpine` + 挂载配置 |
| 本期不做 | HTTPS/证书、子域名、GHCR、合并去掉 interview-nginx |

## 拓扑

```
浏览器  →  edge-nginx :80（interview 仓库 deploy/edge，宿主唯一 80）
              ├─ /movie/              → douban-web:80
              ├─ /api/、/uploads/、/  → interview-nginx:80
                                           └─ 静态 + proxy → app:3000
```

| 组件 | 仓库 | 职责 |
|------|------|------|
| `edge-nginx` | interview `deploy/edge/` | 路径分流；唯一 `80:80` |
| `interview-nginx` | interview 根 compose | SPA + `/api`、`/uploads` → `app`；仅 `expose: 80` |
| `app` + 依赖 | interview 根 compose | 现有业务栈（mongo / postgres / milvus 等） |
| `douban-web` | douban-movie compose | Flutter Web 静态；仅 `expose: 80` |

固定名：网络 `edge-net`；容器 `edge-nginx`、`interview-nginx`、`douban-web`。

## edge（interview 仓库）

路径：

- `deploy/edge/nginx.conf` — 路径分流
- `deploy/edge/docker-compose.yml` — `nginx:alpine`，挂载 conf，`ports: ["80:80"]`，`edge-net` external

反代要点（须用 Docker DNS + 变量，避免启动时解析 `douban-web` 失败）：

```nginx
resolver 127.0.0.11 valid=10s ipv6=off;

location /movie/ {
    set $douban_upstream douban-web:80;
    proxy_pass http://$douban_upstream;   # 保留完整路径
    ...
}
location /api/   { set $interview_upstream interview-nginx:80; proxy_pass http://$interview_upstream; ... }
location /uploads/ { ... }
location /       { ... }
```

## interview 根 compose 改动

- nginx：`ports: ["80:80"]` → `expose: ["80"]`
- `container_name: interview-nginx`
- 同时加入 `interview-net` 与 external `edge-net`
- 应用逻辑、`nginx.conf`（容器内）、`Dockerfile` **不变**

## 可观测性（轻量）

- 响应头：`X-Request-Id`（客户端可传入，否则 edge 生成）、`X-Served-By`（`edge/interview` 或 `edge/douban`）
- edge access log：含 `request id`、`target=`、`upstream=`、耗时
- interview-nginx / Nest access log：透传并记录同一 `requestId`
- 本期不做 ELK/Loki；排障用 `docker logs` + request id 关联

- 现有 SSH deploy 继续 `docker compose up -d --build`（业务栈）
- 若本次变更含 `deploy/edge/`：同 job 内额外  
  `docker compose -f deploy/edge/docker-compose.yml up -d`
- CI 的 `docker compose build` 前若校验需连 `edge-net`：`docker network create edge-net || true`
- douban 仍分仓库 CD，**不**负责启动 edge

## 一次性上线步骤

1. `docker network create edge-net || true`
2. 部署/更新 interview（含 edge 配置进仓库）：根 compose 去掉宿主 80 并 `up -d`
3. 若 douban 已就绪：`cd <douban> && docker compose up -d --build`
4. `cd <interview>/deploy/edge && docker compose up -d`（抢占/接管 80）
5. 冒烟：`/`、`/api/health`、（可选）`/movie/`

切换窗口：去掉 interview `"80:80"` 到 edge 起来之间，公网短暂不可用——尽量同一维护窗口连续执行。

## 回滚

- 入口失败：`docker stop edge-nginx`；interview nginx 恢复 `"80:80"` 并 `compose up -d`
- 业务回滚：根目录 `git reset --hard <旧 sha>` + `compose up -d --build`（edge 配置一并回退时再 `deploy/edge` up）

## 验收

- [ ] `http://<host>/` → interview 正常
- [ ] `/api/health` → 200
- [ ] `/uploads/` 图片可访问（有数据时）
- [ ] `/movie/` → douban（若已部署）
- [ ] interview CD 不误伤 douban；douban CD 不重启 edge（除非人工）

## 与 douban 文档关系

原 douban 设计将 edge 放在 `douban-movie/deploy/edge/`；**已改归属为 interview**。douban 侧只保留 `douban-web` + `edge-net`，README 指向 interview 的 edge 启动方式。

## 非目标

- 去掉 interview-nginx、把静态并进 edge
- HTTPS、子域名、镜像仓库推送部署
