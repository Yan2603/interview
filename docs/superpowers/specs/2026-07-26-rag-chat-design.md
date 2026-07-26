# RAG 检索聊天页设计

**日期：** 2026-07-26  
**状态：** 已确认  
**目标：** 在面试驾驶舱中新增基于 RAG 的聊天页面，支持检索题库与用户上传文档，多轮会话、SSE 流式回答，并展示完整引用来源。

## 背景与目标

现有 AI 能力仅支持「按题目生成参考答案」（`AiService.generateAnswer`），无聊天界面、无向量检索、无文档知识库。为支撑面试备战场景下的知识问答演示与实用检索，一期交付：

1. **RAG 聊天页**：多轮对话、服务端持久化会话、SSE 流式输出  
2. **题库检索**：对题目 `title` / `content` / `notes` / `aiAnswer` 建索引并参与检索  
3. **文档知识库**：上传 Markdown、纯文本、PDF、Word（`.docx`），解析后入向量库  
4. **完整引用**：每条助手回复附带来源列表（题目标题可跳转详情；文档可展开片段）

**非目标（一期不做）：** 多用户权限隔离、人机验证、重排模型（rerank）、Agent 多工具编排、移动端专项适配、登录鉴权与本功能的绑定。

## 实现路径

采用 **方案 2：重度依赖 LangChain 抽象**（Retriever / VectorStore / Document Loaders / Text Splitter / 流式 Chat Model）。业务层（Nest 模块）负责 HTTP、Postgres 持久化、上传与索引编排；检索与生成流水线优先用 LangChain 组件组装。

## 架构

### 存储分工

| 数据 | 存储 |
|---|---|
| 题目、面试事件等现有业务 | MongoDB（不变） |
| 会话、消息、知识库文档元数据 | PostgreSQL |
| 文本 chunk 向量 | Milvus |
| 上传文件本体 | 磁盘 `UPLOAD_DIR`（现有上传卷） |

**文档元数据**指描述「上传了哪些文件」的登记信息（文件名、类型、大小、上传时间、索引状态 `pending|ready|failed`、chunk 数量、磁盘路径等），不是文件字节，也不是向量本身。

### 技术选型

| 层 | 选型 |
|---|---|
| Embedding | `@langchain/openai` + 通义兼容端点（与现有 `AI_API_KEY` / `AI_BASE_URL` 同源） |
| VectorStore | LangChain Milvus 集成 |
| Retriever | `VectorStoreRetriever`（Top-K，可配置分数阈值） |
| 文档加载 | LangChain Document Loaders（txt / md / pdf / docx） |
| 切分 | `RecursiveCharacterTextSplitter` |
| 生成 | 现有 Chat 模型 + LangChain 链（retrieve → prompt → stream） |
| 会话记忆 | PostgreSQL 存消息；请求时加载最近 N 轮拼进 prompt |
| Postgres ORM | TypeORM（与 Nest 常见集成一致） |

### 基础设施

- `docker-compose` 增加 `postgres` 与 `milvus`（及官方单机所需依赖服务）
- 开发环境同样可通过 compose 或本地连接串访问上述服务

### 后端模块边界

```
packages/server/src/
  ai/          # 现有：单题答案生成（保留，不合并进 chat）
  rag/         # 新增：embedding、vectorstore、loader、splitter、retriever 工厂
  knowledge/   # 新增：文档上传、解析与索引、题库索引同步
  chat/        # 新增：会话 CRUD、SSE 流式问答、引用组装
```

### 前端

- 路由：`/chat` → 聊天页；侧栏增加「RAG 聊天」入口
- 代码组织：建议 `packages/client/src/chat/`（视图、组件、API、SSE 解析），与现有 `laser/` 模块化方式一致

## 数据流与索引策略

### 知识库文档入库

```
上传文件
  → PostgreSQL 写文档元数据（status=pending）
  → 落盘 UPLOAD_DIR
  → LangChain Loader 按类型解析
  → RecursiveCharacterTextSplitter 分块
  → Embedding
  → 写入 Milvus（metadata: docId, filename, chunkIndex, sourceType=document）
  → PostgreSQL 更新 status=ready | failed
```

- 删除文档：删除 Postgres 元数据 + 磁盘文件 + Milvus 中该 `docId` 的全部向量
- 一期采用同步处理；单文件超过体积上限（建议 10MB）时返回明确错误
- 不支持的类型返回 400

### 题库索引

- 索引字段：`title`、`content`、`notes`、`aiAnswer`（有内容则纳入）
- metadata：`sourceType=question`、`questionId`、`title`、`categorySlug`
- **同步时机：**
  - 应用启动：全量对账一次（缺则补、源已删则清）
  - 题目 create / update / delete：增量 upsert / delete
- MongoDB 仍为题库真相源；不在 Mongo 中存向量

### 聊天问答（多轮 + RAG）

```
用户发消息
  → PostgreSQL 写入 user 消息
  → 读取该会话最近 N 轮（默认 10）
  → Retriever 用当前问题检索 Top-K（可选附带最近一轮上下文）
  → 组装 system prompt + 历史 + 检索片段
  → LLM SSE 流式输出
  → 结束后写入 assistant 消息及 sources[] 到 PostgreSQL
```

引用结构：

```ts
{
  sourceType: 'question' | 'document';
  id: string;          // questionId 或 docId
  title: string;       // 题目标题或文件名
  snippet: string;     // 命中片段摘要
  score?: number;
}
```

### Collection 策略

使用**单一 collection**（如 `interview_rag`），以 `sourceType` 区分来源。默认同时检索题库与文档；后续可加「仅题库 / 仅文档」筛选，一期可不做 UI 筛选开关。

## API 设计

前缀均为现有全局 `/api`。

### 知识库

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/knowledge/documents` | multipart 上传；返回文档元数据 |
| `GET` | `/knowledge/documents` | 列表（含 status） |
| `DELETE` | `/knowledge/documents/:id` | 删文件 + Postgres + Milvus |
| `POST` | `/knowledge/reindex/questions` | 手动触发题库全量对账 |

### 会话与消息

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/chat/sessions` | 会话列表 |
| `POST` | `/chat/sessions` | 新建会话 |
| `GET` | `/chat/sessions/:id` | 会话详情 + 消息（含 sources） |
| `DELETE` | `/chat/sessions/:id` | 删除会话 |
| `POST` | `/chat/sessions/:id/messages` | 发消息；**SSE 流式**返回 |

SSE 约定：

- `event: token` — 增量文本  
- `event: sources` — 引用列表（可在流结束前发送）  
- `event: done` — 结束  
- `event: error` — 错误  

聊天与上传接口限流严于普通 CRUD（对齐现有 AI 端点量级，如每端点约 10 次 / 60 秒）。

## 前端页面

一页三区（Ant Design Vue，贴合现有应用风格）：

| 区域 | 职责 |
|---|---|
| 左 | 会话列表：新建 / 切换 / 删除 |
| 中 | 消息流 + 输入框；助手气泡下方展示引用来源 |
| 右（或抽屉） | 知识库文档列表 + 上传；显示索引状态 |

交互约定：

- 题库来源点击跳转 `/questions/:id`
- 文档来源可展开 `snippet`
- 流式使用 `fetch` + `ReadableStream`（或等价）解析 SSE
- 助手内容复用现有 Markdown 渲染能力

## 错误处理

| 场景 | 行为 |
|---|---|
| Embedding / LLM 调用失败 | 返回 503；已写入的 user 消息保留，允许重试 |
| Milvus 不可用 | 知识库写入/检索失败并明确提示；不静默假装已检索 |
| 文档解析失败 | 该文档 `failed` + 简短原因；不影响其他文档与聊天 |
| 上传超限 / 不支持类型 | 400，明确错误信息 |
| SSE 中途断开 | 尽量落库已生成内容或标记该条消息失败；前端可重试 |
| 检索无命中 | 仍可基于历史与模型能力回答，但标注「未命中知识库」 |
| 未配置 `AI_API_KEY` | 相关接口 503，前端友好提示 |

## 环境变量（新增）

| 变量 | 说明 |
|---|---|
| `DATABASE_URL` | PostgreSQL 连接串（TypeORM） |
| `MILVUS_URI` | Milvus 地址 |
| `AI_EMBEDDING_MODEL` | Embedding 模型名；默认建议 `text-embedding-v3`（通义兼容，实现时可按控制台可用模型调整） |

复用现有：`AI_API_KEY`、`AI_BASE_URL`、`AI_MODEL`、`UPLOAD_DIR`、`MONGODB_URI`。

## 测试与验收

### 测试策略

- **单元：** 分块逻辑、引用组装、`sourceType` 过滤  
- **集成（本地有依赖时）：** 上传 md → 提问命中 → 引用含该文档  
- **手工验收：** 见下列标准（一期必做）

### 验收标准

1. `/chat` 可新建会话、多轮追问；刷新后历史仍在（PostgreSQL）。  
2. 可上传 md / txt / pdf / docx，列表状态变为 `ready`；删除后不再被检索到。  
3. 针对某题或某文档相关问题提问时，回答下方有完整来源；题库来源可跳转详情。  
4. 回答为 SSE 流式；无命中时有「未命中知识库」类提示且仍能回复。  
5. `docker compose` 可拉起 app + mongo + postgres + milvus；题库变更后增量索引生效。

## 决策记录

| 决策 | 选择 | 原因 |
|---|---|---|
| 实现路径 | LangChain 重度抽象 | 用户指定；便于演示标准 RAG 组件链 |
| 向量库 | Milvus（Docker Compose） | 用户指定；适合面试讲解正经向量库 |
| 会话记忆 | PostgreSQL | 用户指定；结构化多轮消息更合适 |
| 文档元数据 | PostgreSQL | 与会话同属聊天域，删除与状态管理更清晰 |
| 题库真相源 | MongoDB | 保持现有模块不变 |
| 引用展示 | 完整来源列表 | 可验证 RAG 是否真正命中 |
| 流式 | SSE 一期必做 | 聊天体验要求 |
| 文档类型 | md / txt / pdf / docx | 用户指定一期范围 |
