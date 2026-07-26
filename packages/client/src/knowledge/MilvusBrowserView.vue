<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import { api } from '../api';
import { getErrorMessage } from '../utils/error';
import type {
  MilvusCollectionSchema,
  MilvusCollectionSummary,
} from './milvus-types';
import EntityTable from './milvus/EntityTable.vue';

const RAG_COLLECTION = 'interview_rag';

type ViewMode = 'list' | 'detail';

const view = ref<ViewMode>('list');
const selectedName = ref<string | null>(null);

const listLoading = ref(false);
const listError = ref<string | null>(null);
const items = ref<MilvusCollectionSummary[]>([]);

const activeTab = ref('schema');
const schemaLoading = ref(false);
const schema = ref<MilvusCollectionSchema | null>(null);

const dataLoading = ref(false);
const dataRows = ref<Record<string, unknown>[]>([]);
const dataLimit = ref(50);
const dataOffset = ref(0);
const dataFullVector = ref(false);
const dataHasMore = ref(false);

const queryExpr = ref('');
const queryLimit = ref(50);
const queryLoading = ref(false);
const queryRows = ref<Record<string, unknown>[]>([]);

const searchQuery = ref('');
const searchTopK = ref(5);
const searchLoading = ref(false);
const searchRows = ref<Record<string, unknown>[]>([]);

async function loadCollections() {
  listLoading.value = true;
  listError.value = null;
  try {
    const res = await api.listMilvusCollections();
    items.value = res.items;
  } catch (err) {
    items.value = [];
    listError.value = getErrorMessage(err) || '加载 collection 列表失败';
  } finally {
    listLoading.value = false;
  }
}

async function loadSchema(name: string) {
  schemaLoading.value = true;
  try {
    schema.value = await api.getMilvusSchema(name);
  } catch (err) {
    schema.value = null;
    message.error(getErrorMessage(err) || '加载 schema 失败');
  } finally {
    schemaLoading.value = false;
  }
}

async function loadEntities() {
  if (!selectedName.value) return;
  dataLoading.value = true;
  try {
    const res = await api.listMilvusEntities(selectedName.value, {
      limit: dataLimit.value,
      offset: dataOffset.value,
      fullVector: dataFullVector.value,
    });
    dataRows.value = res.rows;
    dataHasMore.value = res.rows.length >= dataLimit.value;
  } catch (err) {
    dataRows.value = [];
    dataHasMore.value = false;
    message.error(getErrorMessage(err) || '加载实体失败');
  } finally {
    dataLoading.value = false;
  }
}

async function runQuery() {
  if (!selectedName.value) return;
  const expr = queryExpr.value.trim();
  if (!expr) {
    message.warning('请输入查询表达式');
    return;
  }
  queryLoading.value = true;
  try {
    const res = await api.queryMilvus(selectedName.value, {
      expr,
      limit: queryLimit.value,
    });
    queryRows.value = res.rows;
  } catch (err) {
    queryRows.value = [];
    message.error(getErrorMessage(err) || '查询失败');
  } finally {
    queryLoading.value = false;
  }
}

async function runSearch() {
  if (!selectedName.value) return;
  const q = searchQuery.value.trim();
  if (!q) {
    message.warning('请输入检索文本');
    return;
  }
  searchLoading.value = true;
  try {
    const res = await api.searchMilvus(selectedName.value, {
      query: q,
      topK: searchTopK.value,
    });
    searchRows.value = res.rows;
  } catch (err) {
    searchRows.value = [];
    message.error(getErrorMessage(err) || '检索失败');
  } finally {
    searchLoading.value = false;
  }
}

async function openDetail(record: MilvusCollectionSummary) {
  selectedName.value = record.name;
  view.value = 'detail';
  activeTab.value = 'schema';
  dataOffset.value = 0;
  dataRows.value = [];
  queryRows.value = [];
  searchRows.value = [];
  queryExpr.value = '';
  searchQuery.value = '';
  await loadSchema(record.name);
}

function backToList() {
  view.value = 'list';
  selectedName.value = null;
  schema.value = null;
}

async function refreshCurrent() {
  if (view.value === 'list') {
    await loadCollections();
    return;
  }
  if (!selectedName.value) return;
  if (activeTab.value === 'schema') {
    await loadSchema(selectedName.value);
  } else if (activeTab.value === 'data') {
    await loadEntities();
  } else if (activeTab.value === 'query') {
    if (queryExpr.value.trim()) await runQuery();
  } else if (activeTab.value === 'search') {
    if (searchQuery.value.trim()) await runSearch();
  }
}

async function onTabChange(key: string | number) {
  const tab = String(key);
  activeTab.value = tab;
  if (!selectedName.value) return;
  if (tab === 'schema' && !schema.value) {
    await loadSchema(selectedName.value);
  } else if (tab === 'data' && dataRows.value.length === 0 && !dataLoading.value) {
    await loadEntities();
  }
}

async function dataPrevPage() {
  dataOffset.value = Math.max(0, dataOffset.value - dataLimit.value);
  await loadEntities();
}

async function dataNextPage() {
  dataOffset.value += dataLimit.value;
  await loadEntities();
}

watch(dataFullVector, () => {
  if (view.value === 'detail' && activeTab.value === 'data') {
    void loadEntities();
  }
});

onMounted(() => {
  void loadCollections();
});
</script>

<template>
  <div class="milvus-browser">
    <!-- 列表 -->
    <section v-if="view === 'list'" class="card">
      <div class="card-body">
        <div class="toolbar">
          <h2>Collection 列表</h2>
          <a-button :loading="listLoading" @click="loadCollections">刷新</a-button>
        </div>
        <p class="desc">点击行查看 schema、实体数据与表达式查询（只读）。</p>

        <a-alert
          v-if="listError"
          type="error"
          show-icon
          :message="listError"
          class="list-alert"
        />

        <a-table
          v-else
          size="small"
          :loading="listLoading"
          :data-source="items"
          row-key="name"
          :pagination="false"
          :custom-row="
            (record: MilvusCollectionSummary) => ({
              onClick: () => openDetail(record),
              style: { cursor: 'pointer' },
            })
          "
        >
          <a-table-column title="名称" data-index="name" key="name" />
          <a-table-column title="行数" data-index="rowCount" key="rowCount" width="120">
            <template #default="{ text }">
              {{ text ?? '—' }}
            </template>
          </a-table-column>
          <a-table-column title="已加载" data-index="loaded" key="loaded" width="100">
            <template #default="{ text }">
              <a-tag v-if="text === true" color="success">是</a-tag>
              <a-tag v-else-if="text === false">否</a-tag>
              <span v-else>—</span>
            </template>
          </a-table-column>
        </a-table>
      </div>
    </section>

    <!-- 详情 -->
    <template v-else>
      <section class="card">
        <div class="card-body">
          <div class="toolbar">
            <div class="detail-title">
              <a-button @click="backToList">返回</a-button>
              <h2>{{ selectedName }}</h2>
            </div>
            <a-button
              :loading="schemaLoading || dataLoading || queryLoading || searchLoading"
              @click="refreshCurrent"
            >
              刷新
            </a-button>
          </div>

          <a-tabs :active-key="activeTab" @change="onTabChange">
            <a-tab-pane key="schema" tab="Schema">
              <a-spin :spinning="schemaLoading">
                <h3 class="section-title">字段</h3>
                <a-table
                  size="small"
                  :data-source="schema?.fields ?? []"
                  row-key="name"
                  :pagination="false"
                >
                  <a-table-column title="字段名" data-index="name" key="name" />
                  <a-table-column title="类型" data-index="dataType" key="dataType" width="140" />
                  <a-table-column title="主键" data-index="isPrimaryKey" key="pk" width="80">
                    <template #default="{ text }">
                      <a-tag v-if="text" color="blue">是</a-tag>
                      <span v-else>—</span>
                    </template>
                  </a-table-column>
                  <a-table-column title="维度" data-index="dim" key="dim" width="100">
                    <template #default="{ text }">
                      {{ text ?? '—' }}
                    </template>
                  </a-table-column>
                </a-table>

                <h3 class="section-title indexes">索引</h3>
                <a-table
                  size="small"
                  :data-source="schema?.indexes ?? []"
                  :row-key="
                    (r: { fieldName: string; indexName: string }) =>
                      `${r.fieldName}-${r.indexName}`
                  "
                  :pagination="false"
                >
                  <a-table-column title="字段" data-index="fieldName" key="fieldName" />
                  <a-table-column title="索引名" data-index="indexName" key="indexName" />
                  <a-table-column title="类型" data-index="indexType" key="indexType" width="120">
                    <template #default="{ text }">
                      {{ text ?? '—' }}
                    </template>
                  </a-table-column>
                  <a-table-column title="度量" data-index="metricType" key="metricType" width="120">
                    <template #default="{ text }">
                      {{ text ?? '—' }}
                    </template>
                  </a-table-column>
                </a-table>
              </a-spin>
            </a-tab-pane>

            <a-tab-pane key="data" tab="Data">
              <div class="tab-toolbar">
                <span>每页</span>
                <a-input-number v-model:value="dataLimit" :min="1" :max="200" :step="10" />
                <a-checkbox v-model:checked="dataFullVector">完整向量</a-checkbox>
                <a-button type="primary" :loading="dataLoading" @click="loadEntities">
                  加载
                </a-button>
                <a-button
                  :disabled="dataOffset <= 0 || dataLoading"
                  @click="dataPrevPage"
                >
                  上一页
                </a-button>
                <a-button
                  :disabled="!dataHasMore || dataLoading"
                  @click="dataNextPage"
                >
                  下一页
                </a-button>
                <span class="pager-meta">offset {{ dataOffset }}</span>
              </div>
              <EntityTable :rows="dataRows" :loading="dataLoading" />
            </a-tab-pane>

            <a-tab-pane key="query" tab="Query">
              <div class="query-form">
                <a-textarea
                  v-model:value="queryExpr"
                  :rows="3"
                  placeholder='sourceType == "question"'
                  allow-clear
                />
                <div class="tab-toolbar">
                  <span>limit</span>
                  <a-input-number v-model:value="queryLimit" :min="1" :max="200" />
                  <a-button type="primary" :loading="queryLoading" @click="runQuery">
                    执行查询
                  </a-button>
                </div>
              </div>
              <EntityTable :rows="queryRows" :loading="queryLoading" />
            </a-tab-pane>

            <a-tab-pane
              v-if="selectedName === RAG_COLLECTION"
              key="search"
              tab="Search"
            >
              <div class="tab-toolbar">
                <a-input
                  v-model:value="searchQuery"
                  placeholder="输入自然语言检索文本"
                  allow-clear
                  style="max-width: 360px"
                  @press-enter="runSearch"
                />
                <span>topK</span>
                <a-input-number v-model:value="searchTopK" :min="1" :max="50" />
                <a-button type="primary" :loading="searchLoading" @click="runSearch">
                  检索
                </a-button>
              </div>
              <EntityTable :rows="searchRows" :loading="searchLoading" />
            </a-tab-pane>
          </a-tabs>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.milvus-browser {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card {
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 10px;
}

.card-body {
  padding: 16px 18px 18px;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.toolbar h2,
.detail-title h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #262626;
}

.detail-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.desc {
  margin: 8px 0 14px;
  font-size: 13px;
  color: #595959;
  line-height: 1.6;
}

.list-alert {
  margin-top: 4px;
}

.section-title {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
  color: #262626;
}

.section-title.indexes {
  margin-top: 20px;
}

.tab-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  font-size: 13px;
  color: #595959;
}

.pager-meta {
  color: #8c8c8c;
}

.query-form {
  margin-bottom: 4px;
}

.query-form :deep(.ant-input) {
  margin-bottom: 12px;
}
</style>
