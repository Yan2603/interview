# Personal Auth (JWT + Passport) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为面试驾驶舱实现个人锁：Passport + JWT（access + refresh）、脚本建号、前端登录/无感刷新/侧栏退出；除 login/refresh/health 外锁定全部 `/api`。

**Architecture:** Nest `AuthModule`（MongoDB User/RefreshToken、Local+JWT Passport、全局 JwtAuthGuard + `@Public()`）。前端 Pinia auth store、`localStorage` 双 token、axios 401 单飞刷新、路由守卫、`/login` 独立页、侧栏底部退出；`streamChatMessage` 共用同一 token 源。

**Tech Stack:** NestJS 10、`@nestjs/passport`、`@nestjs/jwt`、`passport-local`、`passport-jwt`、`bcrypt`、Mongoose、Vue 3、Pinia、Axios、Vitest。

## Global Constraints

- 设计文档：`docs/superpowers/specs/2026-07-29-personal-auth-design.md`（已确认）。
- 个人锁：不做按用户数据隔离；不做 OAuth/短信/开放注册。
- Public 路由仅：`POST /auth/login`、`POST /auth/refresh`、`GET /health`。
- Access TTL 默认 `15m`，Refresh TTL 默认 `7d`；secret 来自 env。
- Refresh 只存哈希；refresh 成功必须轮换（旧 token 作废）。
- Token 存 `localStorage`；无感刷新：401 触发 + 单飞队列。
- 退出入口：`AppLayout` 侧栏底部。
- 静态 `/uploads` 本期不鉴权。
- 用户可见文案中文；提交信息用英文 conventional commits。
- 纯函数/服务逻辑优先 TDD（Vitest）；server：`pnpm --filter @interview/server test`；client：`pnpm --filter @interview/client test`。

## 文件映射

| 路径 | 职责 |
|------|------|
| `packages/server/package.json` | 鉴权依赖 + `create-user` script |
| `.env.example` | JWT 相关 env |
| `packages/server/src/auth/schemas/user.schema.ts` | User |
| `packages/server/src/auth/schemas/refresh-token.schema.ts` | RefreshToken |
| `packages/server/src/auth/auth.service.ts` | 登录/刷新/登出/建号/校验 |
| `packages/server/src/auth/auth.service.test.ts` | AuthService 单测 |
| `packages/server/src/auth/strategies/local.strategy.ts` | Passport Local |
| `packages/server/src/auth/strategies/jwt.strategy.ts` | Passport JWT |
| `packages/server/src/auth/guards/jwt-auth.guard.ts` | 全局 Guard + `@Public` |
| `packages/server/src/auth/decorators/public.decorator.ts` | `@Public()` |
| `packages/server/src/auth/dto/*.ts` | login / refresh / logout DTO |
| `packages/server/src/auth/auth.controller.ts` | HTTP 端点 |
| `packages/server/src/auth/auth.module.ts` | 模块组装 |
| `packages/server/src/auth/create-user.cli.ts` | 建号 CLI |
| `packages/server/src/app.module.ts` | 注册 AuthModule + JwtAuthGuard |
| `packages/server/src/health/health.controller.ts` | `@Public()` |
| `packages/client/src/auth/tokenStorage.ts` | localStorage 读写 |
| `packages/client/src/auth/tokenStorage.test.ts` | 存储单测 |
| `packages/client/src/auth/refreshQueue.ts` | 单飞 refresh |
| `packages/client/src/auth/refreshQueue.test.ts` | 单飞单测 |
| `packages/client/src/auth/authStore.ts` | Pinia store |
| `packages/client/src/api/http.ts` | axios 实例 + 拦截器（从 `api/index.ts` 抽出） |
| `packages/client/src/api/index.ts` | 增加 auth API；使用共享 http |
| `packages/client/src/views/LoginView.vue` | 登录页 |
| `packages/client/src/App.vue` | `/login` 独立布局 |
| `packages/client/src/router/index.ts` | `/login` + beforeEach |
| `packages/client/src/components/layout/AppLayout.vue` | 侧栏底部退出 |
| `packages/client/src/chat/streamMessage.ts` | Authorization 头 |
| `AGENTS.md` / `CLAUDE.md` | 去掉「无身份认证」，补充鉴权说明 |

---

### Task 1: 依赖与环境变量

**Files:**
- Modify: `packages/server/package.json`
- Modify: `.env.example`
- Modify: 根目录 `.env`（仅本地，勿提交密钥）

**Interfaces:**
- Produces: 可 `import` 的 `@nestjs/jwt`、`@nestjs/passport`、`passport-jwt`、`passport-local`、`bcrypt`

- [ ] **Step 1: 安装服务端依赖**

Run:

```bash
pnpm --filter @interview/server add @nestjs/jwt @nestjs/passport passport passport-jwt passport-local bcrypt
pnpm --filter @interview/server add -D @types/passport-jwt @types/passport-local @types/bcrypt
```

Expected: `packages/server/package.json` 出现上述依赖。

- [ ] **Step 2: 更新 `.env.example`**

在文件末尾追加：

```env
# Auth (JWT)
JWT_ACCESS_SECRET=change-me-access-secret
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
```

- [ ] **Step 3: 本地 `.env` 写入真实随机 secret（勿提交）**

- [ ] **Step 4: Commit**

```bash
git add packages/server/package.json pnpm-lock.yaml .env.example
git commit -m "chore(server): add passport jwt and bcrypt deps"
```

---

### Task 2: User / RefreshToken schema + AuthService 核心（TDD）

**Files:**
- Create: `packages/server/src/auth/schemas/user.schema.ts`
- Create: `packages/server/src/auth/schemas/refresh-token.schema.ts`
- Create: `packages/server/src/auth/auth.service.ts`
- Create: `packages/server/src/auth/auth.service.test.ts`

**Interfaces:**
- Produces:
  - `AuthService.createUser(username: string, password: string): Promise<{ id: string; username: string }>`
  - `AuthService.validateUser(username: string, password: string): Promise<{ id: string; username: string } | null>`
  - `AuthService.login(user: { id: string; username: string }): Promise<{ accessToken: string; refreshToken: string; expiresIn: string }>`
  - `AuthService.refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: string }>`
  - `AuthService.logout(userId: string, refreshToken: string): Promise<void>`
  - `AuthService.hashToken(raw: string): string`（sha256 hex，供存库）

- [ ] **Step 1: 写失败单测 `auth.service.test.ts`**

用 vitest + 内存 Map mock `User` / `RefreshToken` 仓库（不必连真实 Mongo）。实现前先写好文件，`import { AuthService } from './auth.service'` 会红。

最小结构（实现时补全 mock，断言保持不变）：

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    // 构造 AuthService(userModelMock, refreshModelMock, jwtServiceMock, configMock)
    // config: access/refresh secrets + TTL 15m / 7d
  });

  it('validateUser returns null for wrong password', async () => {
    await service.createUser('alice', 'Correct1!');
    expect(await service.validateUser('alice', 'wrong')).toBeNull();
  });

  it('refresh rotates token and rejects reused old refresh', async () => {
    const user = await service.createUser('bob', 'Correct1!');
    const first = await service.login(user);
    const second = await service.refresh(first.refreshToken);
    expect(second.accessToken).toBeTruthy();
    await expect(service.refresh(first.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('logout prevents further refresh', async () => {
    const user = await service.createUser('carol', 'Correct1!');
    const tokens = await service.login(user);
    await service.logout(user.id, tokens.refreshToken);
    await expect(service.refresh(tokens.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
```

- [ ] **Step 2: Run 确认失败**

```bash
pnpm --filter @interview/server test -- src/auth/auth.service.test.ts
```

Expected: FAIL（模块/类不存在或断言失败）。

- [ ] **Step 3: 实现 schemas**

`user.schema.ts`：

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, trim: true })
  username!: string;

  @Prop({ required: true })
  passwordHash!: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
```

`refresh-token.schema.ts`：

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class RefreshToken {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, unique: true })
  tokenHash!: string;

  @Prop({ required: true })
  expiresAt!: Date;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);
```

- [ ] **Step 4: 实现 `AuthService`**

要点：
- `bcrypt.hash(password, 10)` / `bcrypt.compare`
- access：`JwtService.signAsync(payload, { secret: accessSecret, expiresIn: accessTtl })`，payload `{ sub: userId, username }`
- refresh：`crypto.randomBytes(48).toString('hex')`，`tokenHash = sha256(raw)`，写入 `RefreshToken`，`expiresAt = now + refreshTtl`
- `refresh`：查 hash → 校验未过期 → **删除旧记录** → 签发新 access + 新 refresh
- 登录失败路径由 strategy 调 `validateUser`；service 不泄露「用户是否存在」

`expiresIn` 响应字段返回配置的 access TTL 字符串（如 `"15m"`）。

- [ ] **Step 5: Run 测试通过**

```bash
pnpm --filter @interview/server test -- src/auth/auth.service.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/auth
git commit -m "feat(server): add auth schemas and AuthService with refresh rotation"
```

---

### Task 3: Passport strategies、Controller、DTOs、AuthModule

**Files:**
- Create: `packages/server/src/auth/decorators/public.decorator.ts`
- Create: `packages/server/src/auth/guards/jwt-auth.guard.ts`
- Create: `packages/server/src/auth/strategies/local.strategy.ts`
- Create: `packages/server/src/auth/strategies/jwt.strategy.ts`
- Create: `packages/server/src/auth/dto/login.dto.ts`
- Create: `packages/server/src/auth/dto/refresh.dto.ts`
- Create: `packages/server/src/auth/dto/logout.dto.ts`
- Create: `packages/server/src/auth/auth.controller.ts`
- Create: `packages/server/src/auth/auth.module.ts`
- Modify: `packages/server/src/app.module.ts`
- Modify: `packages/server/src/health/health.controller.ts`

**Interfaces:**
- Consumes: `AuthService` from Task 2
- Produces:
  - `POST /api/auth/login` → tokens
  - `POST /api/auth/refresh` → tokens
  - `POST /api/auth/logout` → `{ ok: true }`
  - `GET /api/auth/me` → `{ id, username }`
  - `@Public()` metadata key `'isPublic'`
  - Global `JwtAuthGuard`

- [ ] **Step 1: `@Public` + Guard**

```typescript
// public.decorator.ts
import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

```typescript
// jwt-auth.guard.ts
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
```

- [ ] **Step 2: Strategies**

`LocalStrategy`：`usernameField: 'username'`，调用 `authService.validateUser`；null 则 `UnauthorizedException('用户名或密码错误')`。

`JwtStrategy`：从 `Authorization: Bearer` 取 token，`secretOrKey` = `JWT_ACCESS_SECRET`，`validate` 返回 `{ id: payload.sub, username: payload.username }`。

- [ ] **Step 3: DTOs + Controller**

```typescript
// login.dto.ts — class-validator
export class LoginDto {
  @IsString() @MinLength(1) username!: string;
  @IsString() @MinLength(1) password!: string;
}
```

`RefreshDto` / `LogoutDto`：`@IsString() refreshToken`。

Controller：

```typescript
@Controller('auth')
export class AuthController {
  @Public()
  @UseGuards(AuthGuard('local'))
  @Post('login')
  login(@Req() req: { user: { id: string; username: string } }) {
    return this.authService.login(req.user);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  logout(
    @Req() req: { user: { id: string } },
    @Body() dto: LogoutDto,
  ) {
    return this.authService.logout(req.user.id, dto.refreshToken).then(() => ({ ok: true }));
  }

  @Get('me')
  me(@Req() req: { user: { id: string; username: string } }) {
    return { id: req.user.id, username: req.user.username };
  }
}
```

注意：`login` 使用 Local guard；body 需被 LocalStrategy 读取（默认 `username`/`password`）。

- [ ] **Step 4: AuthModule + AppModule**

`AuthModule`：`MongooseModule.forFeature`、`PassportModule`、`JwtModule.registerAsync`（可读 ConfigService；access 默认 secret 用于 JwtService；refresh 在 AuthService 用 Config 单独签/或仅用 JwtService 签 access，refresh 用 random string）。

`app.module.ts`：
- `imports: [AuthModule, ...]`
- `providers` 增加第二个 `APP_GUARD`：`JwtAuthGuard`（保留现有 `ThrottlerGuard`）

`health.controller.ts`：在 class 或 `check` 方法上加 `@Public()`。

- [ ] **Step 5: 手工冒烟（需先有用户；若尚无用户可暂用 mongosh 插一条 bcrypt hash，或先做 Task 4）**

```bash
pnpm --filter @interview/server dev
curl -s http://localhost:3000/api/health
curl -s http://localhost:3000/api/questions
# Expected: health 200; questions 401
```

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/auth packages/server/src/app.module.ts packages/server/src/health/health.controller.ts
git commit -m "feat(server): wire Passport JWT guard and auth HTTP endpoints"
```

---

### Task 4: create-user CLI

**Files:**
- Create: `packages/server/src/auth/create-user.cli.ts`
- Modify: `packages/server/package.json`（scripts）

**Interfaces:**
- Consumes: `AuthService.createUser`
- Produces: `pnpm --filter @interview/server create-user -- --username <n> --password <p>`

- [ ] **Step 1: CLI 实现**

用 `NestFactory.createApplicationContext(AppModule)`，解析 `--username` / `--password`（可用简单 `process.argv`）：

```typescript
async function main() {
  const username = readArg('--username');
  const password = readArg('--password');
  if (!username || !password) {
    console.error('Usage: create-user -- --username <name> --password <pass>');
    process.exit(1);
  }
  const app = await NestFactory.createApplicationContext(AppModule);
  const auth = app.get(AuthService);
  try {
    const user = await auth.createUser(username, password);
    console.log(`Created user ${user.username} id=${user.id}`);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}
```

`createUser`：若 username 已存在抛冲突（`ConflictException` 或 Error `'用户名已存在'`）。

- [ ] **Step 2: package.json script**

```json
"create-user": "nest build && node -r ts-node/register dist/auth/create-user.cli.js"
```

若项目无 `ts-node`，改为 `nest build && node dist/auth/create-user.cli.js`（确保 `create-user.cli.ts` 被 nest 编译；必要时在 `nest-cli.json` assets/entry 确认 `src/**/*.ts` 全量编译）。

推荐实现：

```json
"create-user": "nest build && node dist/auth/create-user.cli.js"
```

并在 `create-user.cli.ts` 底部 `void main()`。

- [ ] **Step 3: 运行建号**

```bash
pnpm --filter @interview/server create-user -- --username admin --password 'Admin123!'
```

Expected: 打印 Created user…

再次运行同名 → 失败「用户名已存在」。

- [ ] **Step 4: 用 curl 验证 login + 受保护 API**

```bash
curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"Admin123!\"}"
# 拿 accessToken
curl -s http://localhost:3000/api/questions -H "Authorization: Bearer <access>"
# Expected: 200 JSON
```

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/auth/create-user.cli.ts packages/server/package.json
git commit -m "feat(server): add create-user CLI for bootstrap account"
```

---

### Task 5: 前端 token 存储 + 单飞 refresh（TDD）

**Files:**
- Create: `packages/client/src/auth/tokenStorage.ts`
- Create: `packages/client/src/auth/tokenStorage.test.ts`
- Create: `packages/client/src/auth/refreshQueue.ts`
- Create: `packages/client/src/auth/refreshQueue.test.ts`

**Interfaces:**
- Produces:
  - `getAccessToken(): string | null`
  - `getRefreshToken(): string | null`
  - `setTokens(access: string, refresh: string): void`
  - `clearTokens(): void`
  - `runSingleFlightRefresh(doRefresh: () => Promise<{ accessToken: string; refreshToken: string }>): Promise<{ accessToken: string; refreshToken: string }>`

- [ ] **Step 1: tokenStorage 测试 + 实现**

Keys：`interview.accessToken`、`interview.refreshToken`。

```typescript
describe('tokenStorage', () => {
  beforeEach(() => localStorage.clear());
  it('roundtrips tokens', () => {
    setTokens('a', 'r');
    expect(getAccessToken()).toBe('a');
    expect(getRefreshToken()).toBe('r');
    clearTokens();
    expect(getAccessToken()).toBeNull();
  });
});
```

Vitest 需 `environment: 'jsdom'` 或手动 mock `localStorage`（若 client vitest 默认无 jsdom，在测试内用内存 mock）：

```typescript
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
});
```

- [ ] **Step 2: refreshQueue 测试 + 实现**

```typescript
it('shares one in-flight refresh among concurrent callers', async () => {
  let calls = 0;
  const doRefresh = async () => {
    calls += 1;
    await new Promise((r) => setTimeout(r, 20));
    return { accessToken: 'newA', refreshToken: 'newR' };
  };
  const [a, b] = await Promise.all([
    runSingleFlightRefresh(doRefresh),
    runSingleFlightRefresh(doRefresh),
  ]);
  expect(calls).toBe(1);
  expect(a.accessToken).toBe('newA');
  expect(b.accessToken).toBe('newA');
});
```

实现：模块级 `let inflight: Promise<...> | null`；finally 清空。

- [ ] **Step 3: Run client tests**

```bash
pnpm --filter @interview/client test -- src/auth
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/auth
git commit -m "feat(client): add token storage and single-flight refresh helper"
```

---

### Task 6: axios 拦截器 + auth API + Pinia store

**Files:**
- Create: `packages/client/src/api/http.ts`
- Modify: `packages/client/src/api/index.ts`
- Create: `packages/client/src/auth/authStore.ts`

**Interfaces:**
- Consumes: tokenStorage、refreshQueue
- Produces:
  - `http` axios instance（带拦截器）
  - `api.login` / `api.refresh` / `api.logout` / `api.me`
  - `useAuthStore()`：`login`、`logout`、`ensureSession`、`user`

- [ ] **Step 1: 抽出 `http.ts`**

将原 `api/index.ts` 中的 `axios.create` 移到 `http.ts` 并 `export const http`。

请求拦截器：

```typescript
http.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

响应拦截器（伪代码必须落实）：
- 若 `error.response?.status !== 401` → reject
- 若 url 包含 `/auth/login` 或 `/auth/refresh` → clearTokens + reject（防死循环）
- 否则 `runSingleFlightRefresh(() => apiRefresh())`，成功则 `setTokens` 并 `http.request(originalConfig)` 重试一次
- 失败 → `clearTokens()`，`window.location.assign('/login?redirect=' + encodeURIComponent(...))` 或交由 router（实现时用 `router` 需避免循环依赖：可用 `window.location` 或轻量 event bus；推荐 `window.location.pathname` 拼 redirect）

单独导出内部 `refreshRequest` 避免循环：

```typescript
export async function refreshTokensRequest(refreshToken: string) {
  const { data } = await axios.post('/api/auth/refresh', { refreshToken });
  // 用裸 axios，不走带拦截器的 http
  return data as { accessToken: string; refreshToken: string; expiresIn: string };
}
```

- [ ] **Step 2: `api/index.ts` 改用 `http`，增加**

```typescript
login: (data: { username: string; password: string }) =>
  http.post<{ accessToken: string; refreshToken: string; expiresIn: string }>('/auth/login', data).then(r => r.data),
refresh: (refreshToken: string) => refreshTokensRequest(refreshToken),
logout: (refreshToken: string) =>
  http.post('/auth/logout', { refreshToken }).then(r => r.data),
me: () => http.get<{ id: string; username: string }>('/auth/me').then(r => r.data),
```

- [ ] **Step 3: Pinia `authStore.ts`**

```typescript
export const useAuthStore = defineStore('auth', {
  state: () => ({ user: null as null | { id: string; username: string } }),
  getters: {
    isAuthenticated: () => Boolean(getAccessToken() || getRefreshToken()),
  },
  actions: {
    async login(username: string, password: string) { /* setTokens + me */ },
    async logout() { /* api.logout + clearTokens + user=null */ },
    async fetchMe() { this.user = await api.me(); },
  },
});
```

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/api packages/client/src/auth/authStore.ts
git commit -m "feat(client): wire axios auth interceptors and auth store"
```

---

### Task 7: Login 页 + 路由守卫 + App 布局

**Files:**
- Create: `packages/client/src/views/LoginView.vue`
- Modify: `packages/client/src/App.vue`
- Modify: `packages/client/src/router/index.ts`

**Interfaces:**
- Consumes: `useAuthStore`、`api`
- Produces: `/login` 可用；未登录访问业务路由跳转登录

- [ ] **Step 1: `LoginView.vue`**

仅用户名 + 密码；提交调 `authStore.login`；成功 `router.replace((route.query.redirect as string) || '/')`；失败 `message.error('用户名或密码错误')` 或接口文案。样式简洁居中卡片即可（对齐原系统灰底，勿过度设计）。

- [ ] **Step 2: `App.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, RouterView } from 'vue-router';
import zhCN from 'ant-design-vue/es/locale/zh_CN';
import AppLayout from './components/layout/AppLayout.vue';

const route = useRoute();
const isStandalone = computed(() => route.path === '/login');
</script>

<template>
  <a-config-provider :locale="zhCN">
    <RouterView v-if="isStandalone" />
    <AppLayout v-else />
  </a-config-provider>
</template>
```

保留原有全局样式。

- [ ] **Step 3: router**

增加 route：

```typescript
{
  path: '/login',
  component: () => import('../views/LoginView.vue'),
  meta: { title: '登录', public: true },
},
```

`beforeEach`：

```typescript
router.beforeEach(async (to) => {
  if (to.meta.public) {
    if (getAccessToken() || getRefreshToken()) {
      return { path: (to.query.redirect as string) || '/' };
    }
    return true;
  }
  if (getAccessToken()) return true;
  if (getRefreshToken()) {
    try {
      const tokens = await runSingleFlightRefresh(() => refreshTokensRequest(getRefreshToken()!));
      setTokens(tokens.accessToken, tokens.refreshToken);
      return true;
    } catch {
      clearTokens();
    }
  }
  return { path: '/login', query: { redirect: to.fullPath } };
});
```

- [ ] **Step 4: 浏览器冒烟**

未登录打开 `/questions` → `/login`；登录后进入应用。

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/views/LoginView.vue packages/client/src/App.vue packages/client/src/router/index.ts
git commit -m "feat(client): add login page and auth route guard"
```

---

### Task 8: 侧栏退出 + 聊天 SSE 带 token

**Files:**
- Modify: `packages/client/src/components/layout/AppLayout.vue`
- Modify: `packages/client/src/chat/streamMessage.ts`

**Interfaces:**
- Consumes: `useAuthStore`、tokenStorage
- Produces: 侧栏底部退出；SSE 请求带 Bearer

- [ ] **Step 1: AppLayout 侧栏底部**

在 `a-layout-sider` 内、`sider-scroll` 下方增加 footer：

```vue
<div class="sider-footer">
  <div v-if="auth.user" class="sider-user">{{ auth.user.username }}</div>
  <a-button type="link" block @click="onLogout">退出登录</a-button>
</div>
```

`onMounted`：若已登录且无 `user`，调 `auth.fetchMe()`。

`onLogout`：`await auth.logout()`（内部 try/finally 清本地）→ `router.push('/login')`。

CSS：footer sticky 在 sider 底部（`margin-top: auto` + sider flex column）。

- [ ] **Step 2: `streamMessage.ts`**

```typescript
import { getAccessToken } from '../auth/tokenStorage';
import { runSingleFlightRefresh } from '../auth/refreshQueue';
import { refreshTokensRequest } from '../api/http';
import { setTokens, getRefreshToken, clearTokens } from '../auth/tokenStorage';

async function authorizedFetch(input: string, init: RequestInit, retried = false): Promise<Response> {
  const headers = new Headers(init.headers);
  const access = getAccessToken();
  if (access) headers.set('Authorization', `Bearer ${access}`);
  const response = await fetch(input, { ...init, headers });
  if (response.status !== 401 || retried) return response;
  const refresh = getRefreshToken();
  if (!refresh) {
    clearTokens();
    return response;
  }
  try {
    const tokens = await runSingleFlightRefresh(() => refreshTokensRequest(refresh));
    setTokens(tokens.accessToken, tokens.refreshToken);
    return authorizedFetch(input, init, true);
  } catch {
    clearTokens();
    return response;
  }
}
```

将原 `fetch(...)` 换成 `authorizedFetch(...)`。

- [ ] **Step 3: 冒烟**

登录 → 侧栏见用户名 → 退出 → 回登录页；聊天发消息在 Network 里可见 Authorization。

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/components/layout/AppLayout.vue packages/client/src/chat/streamMessage.ts
git commit -m "feat(client): add sidebar logout and auth headers for chat SSE"
```

---

### Task 9: 文档同步与端到端验收

**Files:**
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Produces: 文档与实现一致

- [ ] **Step 1: 更新 AGENTS.md / CLAUDE.md**

替换「无身份认证 / 请勿公开部署」相关过时表述为：
- 个人锁 JWT 鉴权已启用
- 建号：`pnpm --filter @interview/server create-user -- --username <n> --password <p>`
- 必需 env：`JWT_ACCESS_SECRET`、可选 TTL（refresh 为 opaque DB 记录，无 JWT_REFRESH_SECRET）
- 仍建议勿对公网裸奔（无注册、单用户场景）

- [ ] **Step 2: 按设计文档手动验收清单跑一遍**

1. 脚本建号并能登录  
2. 无 token 调 `/api/questions` → 401  
3. 登录后题库/日历/聊天可用  
4. 清掉 access 保留 refresh，触发请求可无感续上  
5. 退出后必须重新登录  

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md CLAUDE.md
git commit -m "docs: document personal JWT auth and create-user bootstrap"
```

---

## Spec coverage checklist（自检）

| Spec 项 | Task |
|---------|------|
| User + RefreshToken Mongo | 2 |
| Passport Local + JWT | 3 |
| login/refresh/logout/me | 3 |
| 全局 Guard + Public health/login/refresh | 3 |
| 脚本建号无注册 | 4 |
| access+refresh、轮换、哈希存储 | 2 |
| 前端 login 页 | 7 |
| localStorage + 401 单飞无感刷新 | 5–6 |
| 路由守卫 | 7 |
| 侧栏底部退出 | 8 |
| SSE Authorization | 8 |
| AGENTS/CLAUDE/.env.example | 1, 9 |
| 不做 uploads 鉴权 | （明确跳过） |
| 不做数据隔离/OAuth/短信 | （明确跳过） |
