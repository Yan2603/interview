# RAG 检索质量增强设计

**日期：** 2026-07-26  
**状态：** 已确认  
**范围：** 检索质量包（P0 + P1）— score 阈值与分层决策、检索可观测、多轮 query 改写、结构感知切分  
**前置：** [2026-07-26-rag-chat-design.md](./2026-07-26-rag-chat-design.md)

## 背景与目标

一期 RAG（聊天 + Milvus + 题库/文档双源）已可用，但检索是固定管道：`k=6` 无阈值、仅当前句检索、字符切分、无结构化检索日志。目标在**不引入 tool-calling Agent**的前提下，提升命中率与可信度：

1. **分层决策**：强命中作答；弱命中澄清；空/过低硬拒答  
2. **可观测**：每次问答记录 rewrite / scores / decision / 耗时  
3. **多轮改写**：LLM 将追问改写成独立检索 query，失败回退原句  
4. **切分改进**：题库优先一题一块；文档 Markdown/段落友好切分  

**非目标（本期不做）：** hybrid / rerank、父子块、tool-calling Agent、按 category 过滤 UI、OpenTelemetry、离线评测集、前端 score 调试面板、双路检索。

## 实现路径

采用 **在现有 `ChatRagService` 管道上增强**（业界常见的「先做可靠管道」阶段）：

```
用户消息落库
  →（多轮则）LLM query rewrite（失败回退原句）
  → retrieve(topK) + score→relevance 归一
  → 分层决策：answer | clarify | reject
  → answer：仅 accept 以上 chunk 注入 prompt → SSE 流式作答
     clarify / reject：模板文案 SSE（不调作答 LLM）+ sources
  → 结构化检索日志
  → assistant 消息落库
```

切分改动落在 `rag/text-splitter` 与 `QuestionIndexerService` / `KnowledgeService`；改完后需全量 reindex 题库（及文档按需重索引）后生效。

## 架构

### 模块边界

| 位置 | 职责 |
|------|------|
| `rag/relevance.ts`（新） | 原始 score → `relevance∈[0,1]`；两档阈值过滤 |
| `rag/retrieval-decision.ts`（新） | 纯函数：hits → `answer` \| `clarify` \| `reject` |
| `rag/text-splitter.ts` | 拆成题库 / 文档两套 splitter |
| `chat/query-rewrite.ts`（新） | 多轮改写 + 超时 + 回退 |
| `chat/chat-rag.service.ts` | 编排上述步骤；打检索日志；澄清/拒答模板 |
| `knowledge/question-indexer.service.ts` | 短题整块；超长再切 |
| `knowledge/knowledge.service.ts` | 文档走 Markdown 友好切分 |

不强制抽独立 `RetrievalPipeline` 服务；决策与归一化为可单测纯函数即可，便于以后再抽层。

### 与一期设计的差异（有意覆盖）

一期约定「检索无命中仍可一般性回答并声明未命中」。本期改为：

- **空结果或全部低于 floor** → **硬拒答**（不调作答 LLM）  
- **弱命中** → **澄清**（模板列出 1–2 个候选来源）  
- **强命中** → 仅用 accept 以上片段作答  

即用分层决策替代「软拒答仍生成」。

## 1. 检索分层决策

### 分数归一

LangChain Milvus `similaritySearchWithScore` 的 `score` 在当前集成下按 **L2 距离**理解（越小越相似）。统一映射为内部 **`relevance ∈ [0, 1]`，越大越好**：

```text
relevance = 1 / (1 + max(0, score))
```

若后续确认实际 metric 为内积/余弦相似度（越大越好），则改为有界线性或 sigmoid 映射，并只改这一处函数。阈值只作用在 `relevance` 上；映射须带单测。

### 配置

| 变量 | 含义 | 默认建议 |
|------|------|----------|
| `RAG_TOP_K` | 检索条数 | `6` |
| `RAG_RELEVANCE_ACCEPT` | ≥ 则强命中，可作答；注入 prompt 的下限 | `0.55`（上线后按日志校准） |
| `RAG_RELEVANCE_FLOOR` | ≥ 且 < accept 为弱命中；&lt; floor 丢弃 | `0.35` |
| `RAG_CLARIFY_MAX_SOURCES` | 澄清候选来源数 | `2` |

未配置时使用代码默认值；进程启动打一行 RAG 配置摘要日志。

### 决策规则

对 retrieve 结果计算 `relevance` 后：

1. **reject**：无 hit，或全部 `relevance < floor`  
   - 不调用作答 LLM  
   - SSE：固定中文拒答文案 + `sources: []` + `done`  
   - 持久化 assistant 消息  

2. **clarify**：存在 `relevance ≥ floor`，且 **best &lt; accept**  
   - 不调用作答 LLM  
   - 对过 floor 的结果按 `sourceType:sourceId` 去重，取 top `RAG_CLARIFY_MAX_SOURCES` 标题  
   - 模板文案邀请用户选择（编号列表）  
   - `sources` 带上这些候选（便于跳转）  
   - 持久化 assistant 消息  

3. **answer**：`best ≥ accept`  
   - 仅将 `relevance ≥ accept` 的 chunk 注入 system prompt  
   - 走现有 SSE 流式作答与引用组装  

### 澄清后的下一轮

不引入「选中态」状态机。用户回复「1」或复述标题后，走正常 rewrite + retrieve；改写与阈值应能接住。若体验不足，留待后续增强（非本期）。

## 2. Query 改写

### 触发

- 会话中已有更早消息 → 改写  
- 首轮 → `rewriteStatus: skipped`，直接用当前句  

### 行为

- 输入：当前用户句 + 最近最多 2 轮（约 4 条）上下文（过长截断）  
- 复用现有聊天模型（`LangchainClient` / `AI_MODEL`），**非流式**，只产出一行独立检索 query  
- Prompt 约束：消解指代、补全省略主题、禁止回答问题、禁止解释/引号，仅输出查询文本  
- **不**把改写结果写入用户消息或替换历史  

### 失败回退

下列情况使用原始当前句，并标记 `rewriteStatus: fallback`：

- LLM 抛错 / 超时（`RAG_REWRITE_TIMEOUT_MS`，默认 `3000`）  
- 空输出或过短（&lt; 2 个可见字符）  
- 输出明显异常（多行长文、像在答题）→ 截断失败则回退  

改写失败**不得**导致整次聊天失败。

## 3. 切分策略

### 题库

- 继续用 `buildQuestionIndexText`  
- 全文长度 ≤ `RAG_QUESTION_MAX_CHARS`（默认 `2400`）→ **单 chunk**（`chunkIndex: 0`）  
- 超过 → 用长文本 splitter（与文档类似的递归切分，尺寸可用同一 `RAG_CHUNK_SIZE` / overlap）切开，metadata 仍指向同一题目  

### 文档

- Markdown/段落友好分隔符优先：`\n## `、`\n# `、`\n\n`、`\n`、字符级  
- `chunkSize` 默认 `800`，`chunkOverlap` 默认 `120`（env：`RAG_CHUNK_SIZE`、`RAG_CHUNK_OVERLAP`）  
- 纯文本抽取后的 pdf/docx/txt 同样受益于空行边界  

### API

`RagService` 区分题库切分与知识库文档切分（独立方法或 `mode`），避免误用。

### 迁移

切分逻辑变更**不自动**重写已有向量。验收要求：

- 题库：执行一次 `POST /api/knowledge/reindex/questions`（或知识库管理页全量 reindex）  
- 文档：对需生效的文档重新索引（复用现有「删旧向量再写入」路径；若缺批量入口，文档说明手工重传或逐个触发）  

## 4. 可观测性与错误处理

### 检索日志

每次用户问答结束后（含 clarify/reject），打一条结构化日志（Winston），字段包括：

| 字段 | 说明 |
|------|------|
| `sessionId` | 会话 ID |
| `originalQuery` | 用户原句 |
| `rewrittenQuery` | 实际用于检索的 query |
| `rewriteStatus` | `ok` \| `skipped` \| `fallback` |
| `rewriteMs` / `retrieveMs` | 阶段耗时 |
| `topK` | 使用的 k |
| `hits` | `{ sourceType, sourceId, title, score, relevance, chunkIndex }[]` |
| `decision` | `answer` \| `clarify` \| `reject` |
| `acceptedCount` | 注入 prompt 的 chunk 数 |

**不**记录完整 chunk 正文。排查靠 `sourceId` + `chunkIndex` + Milvus Browser。

### 前端

本期不新增调试 UI。澄清/拒答走现有 SSE：`token`（可一次或少量 chunk）→ `sources` → `done`。

### 错误处理

| 场景 | 行为 |
|------|------|
| Embedding / Milvus 不可用 | 保持现有 503 / SSE `error` |
| 改写失败 | 回退原句，继续检索 |
| 作答中途失败 | 保持现有部分落库 + `error` |
| 阈值未配置 | 代码默认值 + 启动配置摘要 |

## 环境变量（本期新增）

| 变量 | 说明 | 默认 |
|------|------|------|
| `RAG_TOP_K` | 检索条数 | `6` |
| `RAG_RELEVANCE_ACCEPT` | 强命中阈值 | `0.55` |
| `RAG_RELEVANCE_FLOOR` | 弱命中地板 | `0.35` |
| `RAG_CLARIFY_MAX_SOURCES` | 澄清候选数 | `2` |
| `RAG_REWRITE_TIMEOUT_MS` | 改写超时 | `3000` |
| `RAG_QUESTION_MAX_CHARS` | 题库整块上限 | `2400` |
| `RAG_CHUNK_SIZE` | 文档/长题块大小 | `800` |
| `RAG_CHUNK_OVERLAP` | 块重叠 | `120` |

复用：`AI_API_KEY`、`AI_BASE_URL`、`AI_MODEL`、`AI_EMBEDDING_MODEL`、`MILVUS_URI`。

## 测试与验收

### 单元

- `relevance` 映射与阈值过滤  
- 决策：强 / 弱 / 空 → answer / clarify / reject  
- 改写：首轮 skip、失败 fallback、成功替换  
- 题库切分：短题 1 chunk、超长多 chunk  
- 文档 splitter 在含 `##` 标题的文本上优先在标题边界切开  

### 集成（可 mock LLM / vector）

- clarify / reject 路径不调用作答 `stream`  
- answer 路径 prompt 中不含低于 accept 的片段  
- 日志字段齐全（可 spy Logger）  

### 手工验收

1. 首轮明确题库问题 → answer + sources  
2. 追问「展开第二点」→ 日志中有 rewrittenQuery，且仍能命中相关题  
3. 无关问题 → reject 固定文案，无胡编知识点  
4. 模糊问题仅弱相关 → clarify 列出候选，不直接长答  
5. 改切分后 reindex，短题在 Milvus Browser / 题库索引页显示为单 chunk（或符合上限规则）  

## 风险与开放项

- **阈值默认值**：依赖 embedding 与 Milvus metric，需用真实日志校准；实现提供明确默认并在 `.env.example` 注释「需校准」。  
- **澄清后用户回「1」**：无状态机时偶发搜偏；接受为已知限制。  
- **改写额外延迟**：用超时硬顶；首轮不改写。  
