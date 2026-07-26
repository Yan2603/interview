<script setup lang="ts">
import KnowledgePanel from '../chat/components/KnowledgePanel.vue';
</script>

<template>
  <section class="docs-page">
    <div class="docs-panel-wrap">
      <KnowledgePanel />
    </div>
  </section>
</template>

<style scoped>
.docs-panel-wrap {
  height: min(640px, 75vh);
  border: 1px solid #f0f0f0;
  border-radius: 10px;
  overflow: hidden;
  background: #fafafa;
}

.docs-panel-wrap :deep(.knowledge-panel) {
  border-left: none;
  height: 100%;
}
</style>
