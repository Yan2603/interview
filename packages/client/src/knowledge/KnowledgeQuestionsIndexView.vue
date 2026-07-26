<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { message } from 'ant-design-vue';
import { api } from '../api';
import { getErrorMessage } from '../utils/error';
import type { QuestionIndexStatusItem, QuestionIndexStatusResponse } from '../chat/types';

const reindexing = ref(false);
const statusLoading = ref(false);
const lastResult = ref<{ indexed: number; total: number } | null>(null);
const status = ref<QuestionIndexStatusResponse | null>(null);
const filter = ref<'all' | 'indexed' | 'notIndexed' | 'orphan'>('all');
const expandedRowKeys = ref<string[]>([]);

const filteredItems = computed(() => {
  const items = status.value?.items ?? [];
  if (filter.value === 'indexed') return items.filter((i) => i.indexed && !i.orphan);
  if (filter.value === 'notIndexed') return items.filter((i) => !i.indexed && !i.orphan);
  if (filter.value === 'orphan') return items.filter((i) => i.orphan);
  return items;
});

async function loadIndexStatus() {
  statusLoading.value = true;
  try {
    status.value = await api.getQuestionIndexStatus();
  } catch (err) {
    message.error(getErrorMessage(err) || '加载索引对照失败');
  } finally {
    statusLoading.value = false;
  }
}

async function reindexQuestions() {
  reindexing.value = true;
  try {
    const result = await api.reindexQuestions();
    lastResult.value = result;
    message.success(`题库索引完成：${result.indexed}/${result.total}`);
    await loadIndexStatus();
  } catch (err) {
    message.error(getErrorMessage(err) || '题库全量重建失败');
  } finally {
    reindexing.value = false;
  }
}

function rowKey(record: QuestionIndexStatusItem) {
  return record.questionId;
}

onMounted(() => {
  void loadIndexStatus();
});
</script>

<template>
  <div class="questions-index-page">
    <section class="card">
      <div class="card-body">
        <h2>题库向量化</h2>
        <p class="desc">
          将 Mongo 中全部题目（标题、内容、笔记、AI 答案）重新写入 Milvus。耗时与题量、Embedding
          调用有关，请勿频繁点击。
        </p>
        <div class="actions">
          <a-popconfirm
            title="确定全量重建题库索引？将先清空再写入全部题目向量。"
            ok-text="开始重建"
            cancel-text="取消"
            :disabled="reindexing"
            @confirm="reindexQuestions"
          >
            <a-button type="primary" :loading="reindexing">题库全量重建</a-button>
          </a-popconfirm>
          <a-button :loading="statusLoading" @click="loadIndexStatus">刷新对照表</a-button>
          <span v-if="lastResult" class="last-result">
            最近一次重建：成功 {{ lastResult.indexed }} / 共 {{ lastResult.total }}
          </span>
        </div>
        <div v-if="status" class="summary">
          <a-tag>题目 {{ status.summary.totalQuestions }}</a-tag>
          <a-tag color="success">已索引 {{ status.summary.indexed }}</a-tag>
          <a-tag color="warning">未索引 {{ status.summary.notIndexed }}</a-tag>
          <a-tag>Chunk {{ status.summary.totalChunks }}</a-tag>
          <a-tag v-if="status.summary.orphanSources" color="error">
            孤儿 {{ status.summary.orphanSources }}
          </a-tag>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="card-body">
        <div class="status-header">
          <h2>对照表</h2>
          <a-radio-group v-model:value="filter" size="small" button-style="solid">
            <a-radio-button value="all">全部</a-radio-button>
            <a-radio-button value="indexed">已索引</a-radio-button>
            <a-radio-button value="notIndexed">未索引</a-radio-button>
            <a-radio-button value="orphan">孤儿</a-radio-button>
          </a-radio-group>
        </div>
        <a-table
          size="small"
          :loading="statusLoading"
          :data-source="filteredItems"
          :row-key="rowKey"
          :pagination="{ pageSize: 20, showSizeChanger: true }"
          v-model:expandedRowKeys="expandedRowKeys"
        >
          <a-table-column title="标题" key="title">
            <template #default="{ record }">
              <router-link v-if="!record.orphan" :to="`/questions/${record.questionId}`">
                {{ record.title }}
              </router-link>
              <span v-else>{{ record.title }}</span>
            </template>
          </a-table-column>
          <a-table-column title="分类" data-index="categorySlug" key="category" width="120" />
          <a-table-column title="状态" key="status" width="100">
            <template #default="{ record }">
              <a-tag v-if="record.orphan" color="error">孤儿</a-tag>
              <a-tag v-else-if="record.indexed" color="success">已索引</a-tag>
              <a-tag v-else color="default">未索引</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="Chunk" data-index="chunkCount" key="chunkCount" width="80" />

          <template #expandedRowRender="{ record }">
            <div v-if="!record.chunks.length" class="chunk-empty">暂无 chunk（未写入 Milvus）</div>
            <div v-else class="chunk-list">
              <div v-for="c in record.chunks" :key="c.chunkIndex" class="chunk-item">
                <div class="chunk-meta">#{{ c.chunkIndex }}</div>
                <pre class="chunk-text">{{ c.text }}</pre>
              </div>
            </div>
          </template>
        </a-table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.questions-index-page {
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

.card-body h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #262626;
}

.desc {
  margin: 8px 0 0;
  font-size: 13px;
  color: #595959;
  line-height: 1.6;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
}

.last-result {
  font-size: 13px;
  color: #8c8c8c;
}

.summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.status-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.chunk-empty {
  color: #8c8c8c;
  font-size: 13px;
  padding: 4px 0;
}

.chunk-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 100%;
}

.chunk-item {
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  background: #fafafa;
  padding: 8px 10px;
}

.chunk-meta {
  font-size: 12px;
  color: #8c8c8c;
  margin-bottom: 4px;
}

.chunk-text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  line-height: 1.55;
  color: #595959;
  font-family: inherit;
}
</style>
