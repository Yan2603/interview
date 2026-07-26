# 应用内 Milvus 向量库浏览器（只读）

**日期：** 2026-07-26  
**状态：** 已确认  
**目标：** 在面试驾驶舱浏览器内提供类似 Attu 的只读向量库浏览能力，无需单独安装或启动 Attu。

## 背景与目标

项目已用 Milvus 存储 RAG chunk 向量（默认 collection：`interview_rag`），前端有「文档知识库」「题目索引对照」，但无法像 Attu 那样查看任意 collection 的 schema、实体与表达式查询。用户希望在应用内直接完成这些查看，避免再依赖 Attu 容器或本机安装。

### 一期交付

1. **Collection 列表**：列出当前 `MILVUS_URI` 实例上的全部 collection  
2. **Schema**：字段名、类型、主键、向量维数、索引摘要  
3. **Data**：分页浏览实体；向量字段默认截断，可展开完整值  
4. **Query**：Milvus 表达式查询 + 可选 output fields  
5. **Search（限定）**：仅对 `interview_rag` 支持自然语言相似度检索（复用现有 Embedding）

### 非目标

- 删除实体、Drop / 创建 collection、修改 schema  
- 挂载官方 Attu 容器或 iframe 嵌入 Attu  
- 对其它 collection 做自然语言 Search  
- 向量二维/三维可视化图  
- 额外细粒度权限（沿用应用现有登录即可）

## 实现路径

采用 **应用内嵌只读浏览器**（方案 1）：Nest 新增只读 API，前端在「知识库管理」下增加页面；使用已有 `@zilliz/milvus2-sdk-node`，不引入 Attu。

## 架构

```
侧边栏「知识库管理」
  ├─ 文档知识库          /knowledge/documents
  ├─ 题目索引对照        /knowledge/questions
  └─ 向量库浏览器（新）  /knowledge/milvus
         │
         ▼
前端 Vue 页  ──HTTP──▶  Nest milvus-browser 模块（只读）
                              │
                              └──▶  MilvusClient（MILVUS_URI）
```

- **独立模块**：`packages/server/src/milvus-browser/`，与 `RagService` 写入/索引逻辑解耦；不提供 delete / drop / insert 路由。  
- **现有能力不动**：文档上传、题库全量重建、题目索引对照页保持原样。  
- **连接**：读取现有 `MILVUS_URI`；不新增环境变量（除非实现中发现必须）。

## 前端

### 路由与导航

- 路由：`/knowledge/milvus`（挂在现有 `KnowledgeLayout` 下）  
- 侧边栏「知识库管理」增加菜单项：「向量库浏览器」

### 页面结构

**1. Collection 列表**

- 表格：名称、entity 约数（可取则显示）、loaded 状态  
- 行点击进入详情  
- Milvus 不可用：整页明确错误（连接失败 / 超时），不假装空列表

**2. Collection 详情**

顶部：当前 collection 名、返回列表、刷新。

| Tab | 行为 |
|-----|------|
| Schema | 展示字段与索引摘要 |
| Data | 分页实体；向量默认 `dim=N` + 前 8 维预览；「展开」看完整向量或长文本 |
| Query | 输入表达式（如 `sourceType == "question"`）、可选 output fields、limit；结果表同 Data |
| Search | **仅当 name === `interview_rag`** 时显示；输入文本 + topK；走 Embedding + 向量检索 |

全程无删除或其它写操作入口。

## 后端 API

前缀：`/api/milvus-browser`（全局仍有 `/api` 前缀）

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/collections` | 列出全部 collection + 基础状态 |
| `GET` | `/collections/:name/schema` | schema / 字段 / 索引摘要 |
| `GET` | `/collections/:name/entities` | 分页实体；`limit` / `offset`；默认截断向量；`fullVector=1` 返回完整 |
| `POST` | `/collections/:name/query` | body：`{ expr, outputFields?, limit? }` |
| `POST` | `/collections/:name/search` | 仅 `interview_rag`：`{ query, topK? }`；其它 name → `400` |

### 约束与错误

- **无** DELETE / DROP / INSERT 路由  
- Query / entities 的 `limit` 硬上限为 200（超出则按 200 截断或返回 400）  
- collection 不存在 → `404`  
- Milvus 不可达 → `503` + 可读中文信息  
- 查询前按需 `loadCollection`（与现有 RAG 行为一致）；失败信息透传前端  
- Search 复用现有 Embedding 工厂（与 RAG 同源配置）

## 数据与展示约定

- 标量字段原样展示（过长文本可截断 + 展开）  
- Float 向量：默认截断；完整向量仅在显式请求或 UI 展开时返回，避免表格体积爆炸  
- Query 表达式语法为 Milvus 原生 expr，前端不做复杂可视化构建器（一期：文本框即可）

## 测试与验收

1. 侧边栏可进入「向量库浏览器」，能列出实例上全部 collection  
2. 对 `interview_rag` 及其它任意 collection 可查看 schema 与分页 Data  
3. 表达式 Query 可用；向量默认截断且可展开  
4. 仅 `interview_rag` 显示 Search 且能返回带分的结果  
5. UI 与 API 均无写操作；Milvus 停止时有明确错误提示  

建议：服务端对 list / schema / query 路径做基础单测或集成冒烟（Milvus 可用时）；前端以手工验收为主。

## 风险

| 风险 | 缓解 |
|------|------|
| 一次拉全量向量拖垮浏览器 | limit 上限 + 默认截断向量 |
| 其它 collection schema 未知 | 动态按 describeCollection 渲染列 |
| Search 误用于非 RAG collection | 路由与 UI 双重限制为 `interview_rag` |
| 与 Attu 功能期望差距 | 文档与菜单标明「只读浏览器」 |
