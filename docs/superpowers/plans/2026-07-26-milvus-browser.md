# Milvus 只读浏览器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在应用内提供只读「向量库浏览器」：列出 Milvus 全部 collection，查看 schema / 分页实体 / 表达式 Query，并对 `interview_rag` 做自然语言 Search。

**Architecture:** Nest 新增独立 `milvus-browser` 模块（`MilvusClient` + 只读 HTTP API），与 `RagService` 写入解耦；前端在 `/knowledge/milvus` 用 Ant Design 表格 + Tab 呈现。Search 仅允许 `interview_rag`，Embedding 复用 `createEmbeddings`。

**Tech Stack:** NestJS、`@zilliz/milvus2-sdk-node`、`@langchain/openai`（仅 Search）、Vue 3、Ant Design Vue、Vitest。

## Global Constraints

- 设计文档：`docs/superpowers/specs/2026-07-26-milvus-browser-design.md`（已确认）。
- 只读：禁止 delete / drop / insert / alter 路由与 UI。
- Collection 列表：当前 `MILVUS_URI` 实例上**全部** collection。
- Query / entities `limit` 硬上限 **200**（超出按 200 截断）。
- 向量默认截断（前 8 维 + dim）；`fullVector=1` 或 UI 展开才返回完整。
- Search 仅 `interview_rag`（`RAG_COLLECTION_NAME`）；其它 name → `400`。
- 不新增环境变量；使用现有 `MILVUS_URI`。
- UI 文案中文；纯函数优先 TDD；提交用英文 conventional commits。

## 文件映射

| 路径 | 职责 |
|---|---|
| `packages/server/src/milvus-browser/vector-display.ts` | 向量截断 / limit 钳制纯函数 |
| `packages/server/src/milvus-browser/vector-display.test.ts` | 上述单测 |
| `packages/server/src/milvus-browser/milvus-browser.types.ts` | DTO / 响应类型 |
| `packages/server/src/milvus-browser/milvus-browser.service.ts` | Milvus 只读操作 |
| `packages/server/src/milvus-browser/milvus-browser.controller.ts` | HTTP 路由 |
| `packages/server/src/milvus-browser/milvus-browser.module.ts` | Nest 模块 |
| `packages/server/src/app.module.ts` | 注册模块 |
| `packages/client/src/chat/types.ts`（或新建 `knowledge/milvus-types.ts`） | 前端类型 |
| `packages/client/src/api/index.ts` | API 客户端 |
| `packages/client/src/knowledge/MilvusBrowserView.vue` | 列表 + 详情容器 |
| `packages/client/src/knowledge/milvus/EntityTable.vue` | 实体表格（Data/Query/Search 复用） |
| `packages/client/src/knowledge/KnowledgeLayout.vue` | 标题/副标题 |
| `packages/client/src/router/index.ts` | 路由 |
| `packages/client/src/components/layout/AppLayout.vue` | 侧栏菜单与选中态 |

---

### Task 1: 向量展示纯函数（TDD）

**Files:**
- Create: `packages/server/src/milvus-browser/vector-display.ts`
- Create: `packages/server/src/milvus-browser/vector-display.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `export const ENTITY_LIMIT_MAX = 200`
  - `export function clampEntityLimit(limit: unknown, fallback = 50): number`
  - `export type TruncatedVector = { truncated: true; dim: number; preview: number[] } | { truncated: false; dim: number; values: number[] }`
  - `export function truncateVector(values: number[], full: boolean, previewDims = 8): TruncatedVector`
  - `export function mapEntityRow(row: Record<string, unknown>, vectorFieldNames: string[], fullVector: boolean): Record<string, unknown>`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  clampEntityLimit,
  ENTITY_LIMIT_MAX,
  mapEntityRow,
  truncateVector,
} from './vector-display';

describe('clampEntityLimit', () => {
  it('uses fallback for invalid input', () => {
    expect(clampEntityLimit(undefined)).toBe(50);
    expect(clampEntityLimit('x', 20)).toBe(20);
  });
  it('clamps to ENTITY_LIMIT_MAX', () => {
    expect(clampEntityLimit(999)).toBe(ENTITY_LIMIT_MAX);
  });
  it('accepts valid positive ints', () => {
    expect(clampEntityLimit(10)).toBe(10);
  });
});

describe('truncateVector', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  it('returns preview when not full', () => {
    expect(truncateVector(v, false, 3)).toEqual({
      truncated: true,
      dim: 10,
      preview: [1, 2, 3],
    });
  });
  it('returns full values when full', () => {
    expect(truncateVector(v, true)).toEqual({
      truncated: false,
      dim: 10,
      values: v,
    });
  });
});

describe('mapEntityRow', () => {
  it('truncates named vector fields', () => {
    const row = mapEntityRow(
      { text: 'hi', vector: [0.1, 0.2, 0.3, 0.4] },
      ['vector'],
      false,
    );
    expect(row.text).toBe('hi');
    expect(row.vector).toEqual({
      truncated: true,
      dim: 4,
      preview: [0.1, 0.2, 0.3, 0.4].slice(0, 8),
    });
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `pnpm --filter @interview/server test -- src/milvus-browser/vector-display.test.ts`

Expected: FAIL（模块不存在）

- [ ] **Step 3: Implement**

```ts
export const ENTITY_LIMIT_MAX = 200;

export function clampEntityLimit(limit: unknown, fallback = 50): number {
  const n = typeof limit === 'number' ? limit : Number.parseInt(String(limit ?? ''), 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), ENTITY_LIMIT_MAX);
}

export type TruncatedVector =
  | { truncated: true; dim: number; preview: number[] }
  | { truncated: false; dim: number; values: number[] };

export function truncateVector(
  values: number[],
  full: boolean,
  previewDims = 8,
): TruncatedVector {
  const dim = values.length;
  if (full) return { truncated: false, dim, values };
  return { truncated: true, dim, preview: values.slice(0, previewDims) };
}

function isNumberArray(v: unknown): v is number[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'number');
}

export function mapEntityRow(
  row: Record<string, unknown>,
  vectorFieldNames: string[],
  fullVector: boolean,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  const set = new Set(vectorFieldNames);
  for (const key of Object.keys(out)) {
    if (!set.has(key)) continue;
    const val = out[key];
    if (isNumberArray(val)) {
      out[key] = truncateVector(val, fullVector);
    }
  }
  return out;
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `pnpm --filter @interview/server test -- src/milvus-browser/vector-display.test.ts`

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/milvus-browser/vector-display.ts packages/server/src/milvus-browser/vector-display.test.ts
git commit -m "feat(server): add milvus vector display helpers"
```

---

### Task 2: milvus-browser Service + Controller（list / schema / entities / query）

**Files:**
- Create: `packages/server/src/milvus-browser/milvus-browser.types.ts`
- Create: `packages/server/src/milvus-browser/milvus-browser.service.ts`
- Create: `packages/server/src/milvus-browser/milvus-browser.controller.ts`
- Create: `packages/server/src/milvus-browser/milvus-browser.module.ts`
- Modify: `packages/server/src/app.module.ts`（import `MilvusBrowserModule`）

**Interfaces:**
- Consumes: `ConfigService` → `MILVUS_URI`（默认 `http://localhost:19530`）；`ErrorCode` from SDK；`clampEntityLimit` / `mapEntityRow`
- Produces（HTTP，全局前缀 `/api`）:
  - `GET /milvus-browser/collections` → `{ items: CollectionSummary[] }`
  - `GET /milvus-browser/collections/:name/schema` → `CollectionSchemaView`
  - `GET /milvus-browser/collections/:name/entities?limit&offset&fullVector` → `{ rows, limit, offset }`
  - `POST /milvus-browser/collections/:name/query` body `{ expr, outputFields?, limit? }` → `{ rows }`

```ts
// milvus-browser.types.ts（核心形状）
export type CollectionSummary = {
  name: string;
  rowCount: number | null;
  loaded: boolean | null;
};

export type FieldSchemaView = {
  name: string;
  dataType: string;
  isPrimaryKey: boolean;
  dim?: number;
};

export type IndexSchemaView = {
  fieldName: string;
  indexName: string;
  indexType?: string;
  metricType?: string;
};

export type CollectionSchemaView = {
  name: string;
  fields: FieldSchemaView[];
  indexes: IndexSchemaView[];
  vectorFields: string[];
};
```

- [ ] **Step 1: Implement `MilvusBrowserService`**

要点：
- 私有 `getClient(): MilvusClient`，address 去掉协议后传 SDK（与现有一致：若 URI 为 `http://host:19530`，传 `host:19530` 或 SDK 接受的 address；对齐 `milvus.store` / LangChain 用法——本仓库 LangChain 传完整 `url`；SDK `MilvusClient({ address })` 通常要 `localhost:19530`。实现时：`const raw = config.get('MILVUS_URI','http://localhost:19530'); const address = raw.replace(/^https?:\/\//,'');`）
- `listCollections()`：`showCollections`；对每个 name 尽量 `getCollectionStatistics` / `getLoadingProgress`（失败则 `rowCount`/`loaded` 为 `null`，不要整列表失败）
- `describe(name)`：`hasCollection` → 无则 `NotFoundException`；`describeCollection` + `describeIndex`（或 `listIndexes`，以 SDK 实际 API 为准）；识别向量字段（`FloatVector` / data type 含 VECTOR）
- `ensureLoaded(name)`：`loadCollectionSync`；collection 不存在返回 false / 抛 404
- `listEntities(name, { limit, offset, fullVector })`：query 时用 `expr: 'pk >= 0'` 或主键字段 `>= 0` / 空过滤策略——**Milvus 2.x query 需要 expr**。对 LangChain 默认主键 `langchain_primaryid`（VarChar）用不适用数值比较。采用：先 describe 找主键；若为 Int64 用 `"${pk} >= 0"`；若为 VarChar 用 `"${pk} != \"\""`。`output_fields: ['*']` 或全部字段名。应用 `mapEntityRow`。offset：SDK 支持 `offset` 则传入，否则文档注明仅 limit。
- `query(name, { expr, outputFields, limit })`：同样 load + query；空 expr → `BadRequestException('expr 不能为空')`
- Milvus 连接失败：捕获后抛 `ServiceUnavailableException('无法连接 Milvus，请确认服务已启动')`

- [ ] **Step 2: Implement Controller**

```ts
@Controller('milvus-browser')
export class MilvusBrowserController {
  constructor(private readonly service: MilvusBrowserService) {}

  @Get('collections')
  listCollections() {
    return this.service.listCollections();
  }

  @Get('collections/:name/schema')
  schema(@Param('name') name: string) {
    return this.service.getSchema(name);
  }

  @Get('collections/:name/entities')
  entities(
    @Param('name') name: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('fullVector') fullVector?: string,
  ) {
    return this.service.listEntities(name, {
      limit: clampEntityLimit(limit),
      offset: Math.max(0, Number.parseInt(offset ?? '0', 10) || 0),
      fullVector: fullVector === '1' || fullVector === 'true',
    });
  }

  @Post('collections/:name/query')
  query(
    @Param('name') name: string,
    @Body() body: { expr?: string; outputFields?: string[]; limit?: number },
  ) {
    return this.service.query(name, {
      expr: body.expr ?? '',
      outputFields: body.outputFields,
      limit: clampEntityLimit(body.limit),
      fullVector: false,
    });
  }
}
```

- [ ] **Step 3: Module + register in `app.module.ts`**

```ts
@Module({
  controllers: [MilvusBrowserController],
  providers: [MilvusBrowserService],
})
export class MilvusBrowserModule {}
```

在 `app.module.ts` 的 `imports` 增加 `MilvusBrowserModule`。

- [ ] **Step 4: Manual smoke（Milvus 已启动）**

```bash
curl -s http://localhost:3000/api/milvus-browser/collections
curl -s http://localhost:3000/api/milvus-browser/collections/interview_rag/schema
curl -s "http://localhost:3000/api/milvus-browser/collections/interview_rag/entities?limit=5"
curl -s -X POST http://localhost:3000/api/milvus-browser/collections/interview_rag/query \
  -H "Content-Type: application/json" \
  -d "{\"expr\":\"sourceType == \\\"question\\\"\",\"limit\":5}"
```

Expected: JSON 含 items / fields / rows；Milvus 停掉时 503。

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/milvus-browser packages/server/src/app.module.ts
git commit -m "feat(server): add read-only milvus-browser API"
```

---

### Task 3: Search（仅 interview_rag）

**Files:**
- Modify: `packages/server/src/milvus-browser/milvus-browser.service.ts`
- Modify: `packages/server/src/milvus-browser/milvus-browser.controller.ts`
- Modify: `packages/server/src/milvus-browser/milvus-browser.module.ts`（可选：若需 `ConfigService` 已全局可用则无需 import ConfigModule）

**Interfaces:**
- Consumes: `createEmbeddings` from `../rag/embeddings.factory`；`RAG_COLLECTION_NAME` from `../rag/milvus.store`；`Milvus.fromExistingCollection` 或 SDK `search`
- Produces: `POST /milvus-browser/collections/:name/search` body `{ query: string; topK?: number }` → `{ rows: Array<Record<string, unknown> & { score?: number }> }`

- [ ] **Step 1: Service method**

```ts
async search(name: string, input: { query: string; topK?: number }) {
  if (name !== RAG_COLLECTION_NAME) {
    throw new BadRequestException(
      `自然语言 Search 仅支持 collection「${RAG_COLLECTION_NAME}」`,
    );
  }
  const q = (input.query ?? '').trim();
  if (!q) throw new BadRequestException('query 不能为空');
  const topK = Math.min(Math.max(input.topK ?? 6, 1), 50);

  const embeddings = createEmbeddings(this.config);
  const url = this.config.get<string>('MILVUS_URI', 'http://localhost:19530');
  const store = await Milvus.fromExistingCollection(embeddings, {
    collectionName: RAG_COLLECTION_NAME,
    url,
  });
  const results = await store.similaritySearchWithScore(q, topK);
  return {
    rows: results.map(([doc, score]) => ({
      text: doc.pageContent,
      score,
      ...doc.metadata,
    })),
  };
}
```

- [ ] **Step 2: Controller route**

```ts
@Post('collections/:name/search')
@Throttle({ default: { limit: 10, ttl: 60000 } })
search(
  @Param('name') name: string,
  @Body() body: { query?: string; topK?: number },
) {
  return this.service.search(name, {
    query: body.query ?? '',
    topK: body.topK,
  });
}
```

- [ ] **Step 3: Smoke**

```bash
curl -s -X POST http://localhost:3000/api/milvus-browser/collections/interview_rag/search \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"Vue 响应式\",\"topK\":3}"
curl -s -o /dev/null -w "%{http_code}" -X POST \
  http://localhost:3000/api/milvus-browser/collections/other/search \
  -H "Content-Type: application/json" -d "{\"query\":\"x\"}"
```

Expected: 第一条有 rows；第二条 `400`。

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/milvus-browser
git commit -m "feat(server): milvus-browser search for interview_rag"
```

---

### Task 4: 前端类型 + API + 路由/菜单骨架

**Files:**
- Create: `packages/client/src/knowledge/milvus-types.ts`
- Modify: `packages/client/src/api/index.ts`
- Modify: `packages/client/src/router/index.ts`
- Modify: `packages/client/src/components/layout/AppLayout.vue`
- Modify: `packages/client/src/knowledge/KnowledgeLayout.vue`
- Create: `packages/client/src/knowledge/MilvusBrowserView.vue`（先占位：标题 +「加载中」调 list API）

**Interfaces:**
- Consumes: Task 2–3 HTTP 契约
- Produces: `api.listMilvusCollections` 等；路由 `/knowledge/milvus`

- [ ] **Step 1: Types**（与后端 `CollectionSummary` / `CollectionSchemaView` 对齐，复制字段）

- [ ] **Step 2: API methods**

```ts
listMilvusCollections: () =>
  http.get<{ items: MilvusCollectionSummary[] }>('/milvus-browser/collections').then((r) => r.data),

getMilvusSchema: (name: string) =>
  http.get<MilvusCollectionSchema>(`/milvus-browser/collections/${encodeURIComponent(name)}/schema`).then((r) => r.data),

listMilvusEntities: (name: string, params: { limit?: number; offset?: number; fullVector?: boolean }) =>
  http.get<{ rows: Record<string, unknown>[]; limit: number; offset: number }>(
    `/milvus-browser/collections/${encodeURIComponent(name)}/entities`,
    { params: { ...params, fullVector: params.fullVector ? '1' : undefined } },
  ).then((r) => r.data),

queryMilvus: (name: string, body: { expr: string; outputFields?: string[]; limit?: number }) =>
  http.post<{ rows: Record<string, unknown>[] }>(
    `/milvus-browser/collections/${encodeURIComponent(name)}/query`,
    body,
  ).then((r) => r.data),

searchMilvus: (name: string, body: { query: string; topK?: number }) =>
  http.post<{ rows: Record<string, unknown>[] }>(
    `/milvus-browser/collections/${encodeURIComponent(name)}/search`,
    body,
  ).then((r) => r.data),
```

- [ ] **Step 3: Router child**

```ts
{
  path: 'milvus',
  component: () => import('../knowledge/MilvusBrowserView.vue'),
  meta: { title: '向量库浏览器' },
},
```

- [ ] **Step 4: AppLayout**

- `mainSelectedKeys`：`/knowledge/milvus` → `['knowledge-milvus']`
- submenu 增加：

```vue
<a-menu-item key="knowledge-milvus">
  <router-link to="/knowledge/milvus">向量库浏览器</router-link>
</a-menu-item>
```

- [ ] **Step 5: KnowledgeLayout 标题**

`/knowledge/milvus` → 标题「向量库浏览器」，副标题「只读查看 Milvus collection、schema、实体与表达式查询（无需 Attu）。」

- [ ] **Step 6: Stub view** — `onMounted` 调 `listMilvusCollections`，表格渲染 name / rowCount / loaded；错误 `message.error`；行点击暂 `console` 或 `selectedName` ref。

- [ ] **Step 7: Commit**

```bash
git add packages/client/src/knowledge packages/client/src/api/index.ts packages/client/src/router/index.ts packages/client/src/components/layout/AppLayout.vue
git commit -m "feat(client): milvus browser route and API client"
```

---

### Task 5: Collection 详情 UI（Schema / Data / Query / Search）

**Files:**
- Create: `packages/client/src/knowledge/milvus/EntityTable.vue`
- Modify: `packages/client/src/knowledge/MilvusBrowserView.vue`

**Interfaces:**
- Consumes: Task 4 API；`RAG` 常量前端硬编码 `interview_rag` 控制 Search Tab 显示
- Produces: 完整可验收 UI

- [ ] **Step 1: `EntityTable.vue`**

Props: `rows: Record<string, unknown>[]`，`loading: boolean`  
- 动态列：取所有 row keys 的并集  
- 单元格：若值形如 `{ truncated, dim, preview }` 或 `{ truncated: false, values }`，显示 `dim=N · [preview…]`，按钮「展开」用 `a-modal` / `a-drawer` 显示 JSON  
- 普通长字符串：超过 120 字截断 + 展开  
- `score` 列若存在优先靠前

- [ ] **Step 2: `MilvusBrowserView.vue` 完整流程**

状态机：
- `view: 'list' | 'detail'`
- `selectedName: string | null`

**列表：** Task 4 表格；点击行 → 加载 schema + 切 detail；「刷新」重拉 collections。

**详情顶栏：** `a-button` 返回；标题 `selectedName`；刷新当前 Tab 数据。

**Tabs：**
1. **Schema** — `a-table` fields；下方 indexes 表  
2. **Data** — `limit` 默认 50、分页用 `offset`（上一页/下一页或 Ant Pagination）；调 `listMilvusEntities`；勾选「完整向量」则 `fullVector: true`  
3. **Query** — `a-textarea` expr（placeholder：`sourceType == "question"`）；可选 limit；提交调 `queryMilvus`；结果 `EntityTable`  
4. **Search** — `v-if="selectedName === 'interview_rag'"`；`a-input` + topK + 按钮；`searchMilvus`；结果 `EntityTable`

错误：统一 `getErrorMessage` + `message.error`；列表页 Milvus 挂掉时用 `a-alert` type=error 展示，不要空表装成功。

- [ ] **Step 3: 手工验收（对照 spec）**

1. 侧栏进入「向量库浏览器」，能看到全部 collection  
2. 打开 `interview_rag`：Schema / Data / Query / Search 均可用  
3. 向量默认截断、可展开  
4. 任意其它 collection（若有）无 Search Tab  
5. 停掉 Milvus 后刷新列表，出现明确错误  

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/knowledge
git commit -m "feat(client): milvus browser detail tabs (schema/data/query/search)"
```

---

## Spec coverage（自检）

| Spec 要求 | Task |
|-----------|------|
| Collection 列表（全部） | 2, 4, 5 |
| Schema | 2, 5 |
| Data 分页 + 向量截断 | 1, 2, 5 |
| Query 表达式 | 2, 5 |
| Search 仅 interview_rag | 3, 5 |
| 只读 / 无 Attu | 全局约束 + 无写路由 |
| limit 200 | 1, 2 |
| 503 / 404 | 2 |
| 侧栏入口 `/knowledge/milvus` | 4 |

无 TBD 占位；类型名前后一致（`CollectionSummary` / 前端 `MilvusCollectionSummary` 映射清晰）。
