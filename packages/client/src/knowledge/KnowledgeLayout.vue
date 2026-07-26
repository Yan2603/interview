<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

const pageTitle = computed(() => {
  if (route.path.startsWith('/knowledge/questions')) return '题目索引对照';
  if (route.path.startsWith('/knowledge/milvus')) return '向量库浏览器';
  return '文档知识库';
});

const pageSubtitle = computed(() => {
  if (route.path.startsWith('/knowledge/questions')) {
    return '查看题目是否已入向量索引，并手动全量重建题库。';
  }
  if (route.path.startsWith('/knowledge/milvus')) {
    return '只读查看 Milvus collection、schema、实体与表达式查询（无需 Attu）。';
  }
  return '上传并管理文档知识库，供 RAG 聊天检索。';
});
</script>

<template>
  <div class="knowledge-layout">
    <header class="page-header">
      <h1>{{ pageTitle }}</h1>
      <p class="subtitle">{{ pageSubtitle }}</p>
    </header>
    <RouterView />
  </div>
</template>

<style scoped>
.knowledge-layout {
  max-width: 1100px;
  margin: 0 auto;
  padding: 8px 4px 32px;
}

.page-header h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  color: #262626;
}

.subtitle {
  margin: 8px 0 16px;
  color: #8c8c8c;
  font-size: 14px;
  line-height: 1.6;
}
</style>
