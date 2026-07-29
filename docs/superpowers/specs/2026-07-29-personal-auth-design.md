# Personal Auth (JWT + Passport) Design

日期：2026-07-29  
状态：已评审待实现

## 目标

为面试驾驶舱增加**个人锁**鉴权：未登录无法使用应用与几乎全部 API；登录后可访问现有全部数据。

- 单人自用为主，不做按用户的数据隔离
- 用户名 + 密码存 MongoDB
- 首个账号由脚本/seed 手动创建，**不开放注册**
- Passport + JWT：短期 access token + 长期 refresh token，支持无感刷新

## 非目标（本期不做）

- OAuth / 第三方登录
- 短信验证码
- 开放注册页/接口
- 多用户数据隔离、角色权限
- 提前定时刷新 access（仅在 401 时无感刷新）

## 架构

### 后端

新增 `AuthModule`（NestJS）：

- MongoDB `User`、`RefreshToken`（Mongoose，与题库主栈一致）
- Passport：`LocalStrategy`（用户名密码）、`JwtStrategy`（校验 access）
- 全局 `JwtAuthGuard`（`APP_GUARD`）：默认要求有效 access
- `@Public()` 装饰器放行：`POST /auth/login`、`POST /auth/refresh`、`GET /health`（及健康检查既有路径）
- 密码：bcrypt 哈希存储；登录失败返回模糊文案（如「用户名或密码错误」）

### 前端

- `/login`：用户名 + 密码，独立布局（无侧栏）
- auth 状态模块：token、`user`、`login` / `logout` / `refresh`
- axios：自动附带 `Authorization: Bearer <access>`；401 时无感刷新
- 路由守卫：未登录 → `/login?redirect=...`
- `AppLayout` **侧栏底部**：「退出登录」+ 可选展示当前用户名

### 数据范围

登录只控制「能否进入」；题库、日历、聊天、知识库等数据**不按 userId 过滤**（个人锁语义）。

静态资源路径 `/uploads`（非 `/api`）本期**不强制鉴权**；所有 JSON 业务 API 必须鉴权。若部署后发现直链风险再补。

## 数据模型

### User（MongoDB）

| 字段 | 说明 |
|------|------|
| `username` | 唯一、必填 |
| `passwordHash` | bcrypt |
| `createdAt` / `updatedAt` | 时间戳 |

### RefreshToken（MongoDB）

| 字段 | 说明 |
|------|------|
| `userId` | 关联 User |
| `tokenHash` | 仅存哈希，不存明文 |
| `expiresAt` | 过期时间 |
| `createdAt` | 创建时间 |

登出或 refresh 轮换时删除/作废对应记录。

### 建号

提供 CLI/脚本，例如：

```bash
pnpm --filter server create-user -- --username <name> --password <pass>
```

无 `POST /auth/register`。重复用户名应失败。

## API

均在全局前缀 `/api` 下。

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| `POST` | `/auth/login` | body: `{ username, password }` → `{ accessToken, refreshToken, expiresIn }` | Public |
| `POST` | `/auth/refresh` | body: `{ refreshToken }` → 新 access（并轮换 refresh） | Public |
| `POST` | `/auth/logout` | body: `{ refreshToken }`，作废该 refresh | 需 access |
| `GET` | `/auth/me` | 当前用户基本信息（如 `username`） | 需 access |
| `GET` | `/health` | 健康检查 | Public |
| * | 其余 `/api/*` | 现有业务 | 需有效 access |

### 环境变量

写入 `.env.example`（真实值仅本地 `.env`）：

- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_TTL`（默认如 `15m`）
- `JWT_REFRESH_TTL`（默认如 `7d`）

## 无感刷新

1. **触发**：业务请求返回 401（access 过期/无效）时再刷，不做提前定时刷。
2. **流程**：拦截器暂停该请求 → `POST /auth/refresh` → 持久化新 token → 用新 access **重试原请求一次**。
3. **并发**：同一时刻只发起一次 refresh；其余 401 请求排队，拿到新 token 后重试。
4. **失败**：refresh 失败 → 清本地 token → 跳 `/login`（可带 `redirect`）；可选轻提示「登录已过期，请重新登录」。
5. **存储**：access + refresh 均存 `localStorage`。
6. **轮换**：refresh 成功后旧 refresh 作废，只保留新 refresh。
7. **防死循环**：`POST /auth/login`、`POST /auth/refresh` 不参与「401 → refresh」逻辑。

### SSE / 流式请求

聊天等 `fetch`/stream 与 axios **共用同一 token 存储**。优先：401 时先 refresh 再重试发起；若某条路径实现成本过高，最低要求为清会话并跳登录，避免半截流一直挂起。

## 前端细节

### 路由与布局

- 恢复 `/login` 与 `App.vue` 独立布局分支
- 除 `/login` 外均需登录态
- 已登录访问 `/login` → 首页或 `redirect`

### 退出

- 入口：`AppLayout` 侧栏底部「退出登录」
- 调用 `POST /auth/logout`，body 带当前 `refreshToken`（失败也清本地）→ 跳 `/login`

### 文档同步

实现时更新 `AGENTS.md` / `CLAUDE.md`：说明已有鉴权、建号方式、JWT 相关 env；去掉「无身份认证」的过时描述。

## 测试与验收

### 后端

- 正确登录返回双 token；错误凭证 401 + 模糊文案
- 无/坏 token 访问受保护接口 → 401；health/login/refresh 可匿名（refresh 仍需合法 body）
- 有效 refresh 换新 token且旧 refresh 失效；过期/吊销不可再刷
- logout 后 refresh 不可用
- 建号脚本成功；重复用户名失败

### 前端

- 未登录访问业务页 → `/login`
- 登录后 API 带 token，功能正常
- access 过期时一次业务请求可无感续上
- 并发 401 只刷一次 refresh
- refresh 失效 → 跳登录
- 退出后需重新登录

### 手动验收清单

1. 无用户时用脚本建号并能登录  
2. 未带 token 请求 `/api/questions` → 401  
3. 登录后正常使用题库/日历/聊天等  
4. access 无效或过期且 refresh 有效时，操作可自动续上  
5. 退出或 refresh 失效后必须重新登录  

## 决策记录

| 项 | 选择 |
|----|------|
| 目标 | 个人锁，非多用户隔离 |
| 凭证 | 用户名 + 密码（MongoDB） |
| 建号 | 脚本手动，无注册 |
| 会话 | Passport + JWT access + refresh |
| API 保护 | 除 login/refresh/health 外全锁 |
| Token 存储 | localStorage |
| 无感刷新 | 401 触发 + 单飞队列 + refresh 轮换 |
| 退出入口 | 侧栏底部 |
