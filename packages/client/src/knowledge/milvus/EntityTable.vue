<script setup lang="ts">
import { computed, ref } from 'vue';
import type { TruncatedVector } from '../milvus-types';

const props = withDefaults(
  defineProps<{
    rows: Record<string, unknown>[];
    loading?: boolean;
  }>(),
  { loading: false },
);

const expandOpen = ref(false);
const expandTitle = ref('详情');
const expandBody = ref('');

const columns = computed(() => {
  const keys = new Set<string>();
  for (const row of props.rows) {
    for (const key of Object.keys(row)) keys.add(key);
  }
  const list = Array.from(keys);
  list.sort((a, b) => {
    if (a === 'score') return -1;
    if (b === 'score') return 1;
    return a.localeCompare(b);
  });
  return list;
});

function isTruncatedVector(value: unknown): value is TruncatedVector {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.truncated !== 'boolean') return false;
  if (typeof v.dim !== 'number') return false;
  if (v.truncated === true) return Array.isArray(v.preview);
  return Array.isArray(v.values);
}

function formatVectorPreview(vec: TruncatedVector): string {
  const nums = vec.truncated ? vec.preview : vec.values.slice(0, 8);
  const preview = nums.map((n) => (typeof n === 'number' ? n.toFixed(4) : String(n))).join(', ');
  const suffix = vec.truncated || vec.values.length > 8 ? '…' : '';
  return `dim=${vec.dim} · [${preview}${suffix}]`;
}

function cellKind(value: unknown): 'vector' | 'long-string' | 'plain' {
  if (isTruncatedVector(value)) return 'vector';
  if (typeof value === 'string' && value.length > 120) return 'long-string';
  return 'plain';
}

function formatPlain(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function openExpand(title: string, value: unknown) {
  expandTitle.value = title;
  try {
    expandBody.value =
      typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  } catch {
    expandBody.value = String(value);
  }
  expandOpen.value = true;
}

function rowKey(record: Record<string, unknown>, index: number) {
  const id = record.id ?? record.pk ?? record._id;
  return id !== undefined && id !== null ? String(id) : `row-${index}`;
}
</script>

<template>
  <div class="entity-table">
    <a-table
      size="small"
      :loading="loading"
      :data-source="rows"
      :row-key="rowKey"
      :pagination="false"
      :scroll="{ x: 'max-content' }"
    >
      <a-table-column
        v-for="col in columns"
        :key="col"
        :title="col"
        :data-index="col"
      >
        <template #default="{ text, record }">
          <template v-if="cellKind(text) === 'vector' && isTruncatedVector(text)">
            <span class="cell-preview">{{ formatVectorPreview(text) }}</span>
            <a-button type="link" size="small" @click="openExpand(col, text)">
              展开
            </a-button>
          </template>
          <template v-else-if="cellKind(text) === 'long-string'">
            <span class="cell-preview">{{ String(text).slice(0, 120) }}…</span>
            <a-button type="link" size="small" @click="openExpand(col, text)">
              展开
            </a-button>
          </template>
          <template v-else>
            <span class="cell-plain">{{ formatPlain(text ?? record[col]) }}</span>
          </template>
        </template>
      </a-table-column>
    </a-table>

    <a-modal
      v-model:open="expandOpen"
      :title="expandTitle"
      width="720px"
      :footer="null"
      destroy-on-close
    >
      <pre class="expand-body">{{ expandBody }}</pre>
    </a-modal>
  </div>
</template>

<style scoped>
.cell-preview {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  color: #595959;
  word-break: break-all;
}

.cell-plain {
  font-size: 13px;
  color: #262626;
  word-break: break-word;
}

.expand-body {
  margin: 0;
  max-height: 60vh;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  line-height: 1.55;
  color: #262626;
  background: #fafafa;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  padding: 12px;
}
</style>
