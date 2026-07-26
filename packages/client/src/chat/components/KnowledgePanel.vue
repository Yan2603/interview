<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { message } from 'ant-design-vue';
import { api } from '../../api';
import { getErrorMessage } from '../../utils/error';
import type { KnowledgeDocument } from '../types';

const documents = ref<KnowledgeDocument[]>([]);
const loading = ref(false);
const uploading = ref(false);
let pollTimer: ReturnType<typeof setInterval> | null = null;

const STATUS_LABEL: Record<KnowledgeDocument['status'], string> = {
  pending: '索引中',
  ready: '就绪',
  failed: '失败',
};

const STATUS_COLOR: Record<KnowledgeDocument['status'], string> = {
  pending: 'processing',
  ready: 'success',
  failed: 'error',
};

function formatSize(sizeBytes: string) {
  const n = Number(sizeBytes);
  if (!Number.isFinite(n) || n < 0) return sizeBytes;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function loadDocuments() {
  loading.value = true;
  try {
    documents.value = await api.listKnowledgeDocuments();
    syncPolling();
  } catch (err) {
    message.error(getErrorMessage(err) || '加载知识库失败');
  } finally {
    loading.value = false;
  }
}

function syncPolling() {
  const needsPoll = documents.value.some((d) => d.status === 'pending');
  if (needsPoll && !pollTimer) {
    pollTimer = setInterval(() => {
      void refreshQuiet();
    }, 3000);
  } else if (!needsPoll && pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function refreshQuiet() {
  try {
    documents.value = await api.listKnowledgeDocuments();
    syncPolling();
  } catch {
    /* ignore background poll errors */
  }
}

async function onUpload(file: File) {
  uploading.value = true;
  try {
    await api.uploadKnowledgeDocument(file);
    message.success('上传成功');
    await loadDocuments();
  } catch (err) {
    message.error(getErrorMessage(err) || '上传失败');
  } finally {
    uploading.value = false;
  }
  return false;
}

async function removeDoc(id: string) {
  try {
    await api.deleteKnowledgeDocument(id);
    message.success('已删除');
    documents.value = documents.value.filter((d) => d.id !== id);
    syncPolling();
  } catch (err) {
    message.error(getErrorMessage(err) || '删除失败');
  }
}

onMounted(() => {
  void loadDocuments();
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
});
</script>

<template>
  <div class="knowledge-panel">
    <div class="knowledge-header">
      <span class="knowledge-title">知识库</span>
      <a-upload
        :show-upload-list="false"
        :before-upload="onUpload"
        accept=".md,.txt,.pdf,.docx"
        :disabled="uploading"
      >
        <a-button size="small" :loading="uploading">上传</a-button>
      </a-upload>
    </div>
    <p class="hint">支持 .md / .txt / .pdf / .docx</p>
    <a-spin :spinning="loading">
      <a-empty v-if="!loading && documents.length === 0" description="暂无文档" :image="false" />
      <ul v-else class="doc-list">
        <li v-for="doc in documents" :key="doc.id" class="doc-item">
          <div class="doc-main">
            <span class="doc-name" :title="doc.filename">{{ doc.filename }}</span>
            <a-tag :color="STATUS_COLOR[doc.status]" class="doc-status">
              {{ STATUS_LABEL[doc.status] }}
            </a-tag>
          </div>
          <div class="doc-meta">
            <span>{{ formatSize(doc.sizeBytes) }}</span>
            <span v-if="doc.status === 'ready'">{{ doc.chunkCount }} 块</span>
            <span v-if="doc.status === 'failed' && doc.errorMessage" class="doc-error" :title="doc.errorMessage">
              {{ doc.errorMessage }}
            </span>
          </div>
          <a-popconfirm
            title="确定删除该文档？"
            ok-text="删除"
            cancel-text="取消"
            @confirm="removeDoc(doc.id)"
          >
            <a-button type="link" size="small" danger class="doc-delete">删除</a-button>
          </a-popconfirm>
        </li>
      </ul>
    </a-spin>
  </div>
</template>

<style scoped>
.knowledge-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  background: #fafafa;
  border-left: 1px solid #f0f0f0;
  padding: 0 0 12px;
}

.knowledge-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
}

.knowledge-title {
  font-weight: 600;
  color: #262626;
}

.hint {
  margin: 8px 14px 0;
  font-size: 12px;
  color: #8c8c8c;
}

.doc-list {
  list-style: none;
  margin: 0;
  padding: 8px 10px;
  overflow-y: auto;
}

.doc-item {
  position: relative;
  padding: 10px 10px 8px;
  margin-bottom: 6px;
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
}

.doc-main {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding-right: 40px;
}

.doc-name {
  flex: 1;
  font-size: 13px;
  color: #262626;
  word-break: break-all;
}

.doc-status {
  flex-shrink: 0;
  margin-inline-end: 0;
}

.doc-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
  font-size: 12px;
  color: #8c8c8c;
}

.doc-error {
  color: #ff4d4f;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.doc-delete {
  position: absolute;
  top: 6px;
  right: 4px;
  padding: 0 4px;
}
</style>
