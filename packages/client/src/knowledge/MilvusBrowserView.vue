<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { message } from 'ant-design-vue';
import { api } from '../api';
import { getErrorMessage } from '../utils/error';
import type { MilvusCollectionSummary } from './milvus-types';

const loading = ref(false);
const items = ref<MilvusCollectionSummary[]>([]);
const selectedName = ref<string | null>(null);

async function loadCollections() {
  loading.value = true;
  try {
    const res = await api.listMilvusCollections();
    items.value = res.items;
  } catch (err) {
    message.error(getErrorMessage(err) || '加载 collection 列表失败');
  } finally {
    loading.value = false;
  }
}

function onRowClick(record: MilvusCollectionSummary) {
  selectedName.value = record.name;
}

onMounted(() => {
  void loadCollections();
});
</script>

<template>
  <section class="milvus-browser">
    <a-table
      size="small"
      :loading="loading"
      :data-source="items"
      row-key="name"
      :pagination="false"
      :custom-row="
        (record: MilvusCollectionSummary) => ({
          onClick: () => onRowClick(record),
          style: { cursor: 'pointer' },
        })
      "
      :row-class-name="
        (record: MilvusCollectionSummary) =>
          record.name === selectedName ? 'row-selected' : ''
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
  </section>
</template>

<style scoped>
.milvus-browser :deep(.row-selected) > td {
  background: #e6f4ff;
}
</style>
