<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import axios from 'axios';
import { api, MASTERY_COLORS, MASTERY_LABELS } from '../api';
import { renderMarkdown } from '../utils/markdown';
import type { Category, Mastery, Question } from '../types';

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const questions = ref<Question[]>([]);
const categories = ref<Category[]>([]);
const search = ref('');
const mastery = ref<Mastery | undefined>();
const aiLoadingId = ref<string | null>(null);
const previewOpen = ref(false);
const previewQuestion = ref<Question | null>(null);

const categoryFilter = computed(() => route.query.category as string | undefined);

const categoryName = computed(() => {
  if (!categoryFilter.value) return '全部题目';
  return categories.value.find((c) => c.slug === categoryFilter.value)?.name ?? categoryFilter.value;
});

const modalOpen = ref(false);
const form = ref({ title: '', categorySlug: 'vue3', content: '', tags: '' });

function hasAiAnswer(record: Question) {
  return Boolean(record.aiAnswer?.trim());
}

function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    return Array.isArray(msg) ? msg.join(', ') : (msg ?? err.message);
  }
  return err instanceof Error ? err.message : '请求失败';
}

async function load() {
  loading.value = true;
  try {
    questions.value = await api.getQuestions({
      category: categoryFilter.value,
      search: search.value || undefined,
      mastery: mastery.value,
    });
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  categories.value = await api.getCategories();
  form.value.categorySlug = categoryFilter.value ?? categories.value[0]?.slug ?? 'vue3';
  await load();
});

watch([() => route.query.category, mastery], load);

async function onSearch() {
  await load();
}

async function createQuestion() {
  await api.createQuestion({
    title: form.value.title,
    categorySlug: form.value.categorySlug,
    content: form.value.content,
    tags: form.value.tags
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean),
  });
  modalOpen.value = false;
  form.value = { title: '', categorySlug: form.value.categorySlug, content: '', tags: '' };
  await load();
}

function openDetail(id: string) {
  router.push(`/questions/${id}`);
}

function openPreview(record: Question, event?: Event) {
  event?.stopPropagation();
  previewQuestion.value = record;
  previewOpen.value = true;
}

async function generateAi(record: Question, event?: Event) {
  event?.stopPropagation();
  aiLoadingId.value = record._id;
  try {
    const { aiAnswer } = await api.generateAiAnswer(record._id);
    const idx = questions.value.findIndex((q) => q._id === record._id);
    if (idx >= 0) {
      questions.value[idx] = { ...questions.value[idx], aiAnswer };
    }
    previewQuestion.value = { ...record, aiAnswer };
    previewOpen.value = true;
    message.success('AI 作答完成');
  } catch (err) {
    message.error(getErrorMessage(err));
  } finally {
    aiLoadingId.value = null;
  }
}
</script>

<template>
  <div>
    <div class="toolbar">
      <h2 style="margin: 0">{{ categoryName }}</h2>
      <a-space>
        <a-input-search
          v-model:value="search"
          placeholder="搜索题目"
          style="width: 240px"
          @search="onSearch"
        />
        <a-select
          v-model:value="mastery"
          allow-clear
          placeholder="掌握度"
          style="width: 120px"
          @change="load"
        >
          <a-select-option value="new">{{ MASTERY_LABELS.new }}</a-select-option>
          <a-select-option value="reviewing">{{ MASTERY_LABELS.reviewing }}</a-select-option>
          <a-select-option value="mastered">{{ MASTERY_LABELS.mastered }}</a-select-option>
        </a-select>
        <a-button type="primary" @click="modalOpen = true">新建题目</a-button>
      </a-space>
    </div>

    <a-table
      :loading="loading"
      :data-source="questions"
      :columns="[
        { title: '题目', dataIndex: 'title', key: 'title' },
        { title: '分类', dataIndex: 'categorySlug', key: 'categorySlug', width: 120 },
        { title: '掌握度', key: 'mastery', width: 100 },
        { title: 'AI', key: 'ai', width: 180 },
        { title: '标签', key: 'tags', width: 180 },
      ]"
      row-key="_id"
      :pagination="{ pageSize: 20 }"
      :custom-row="(record: Question) => ({ onClick: () => openDetail(record._id), style: { cursor: 'pointer' } })"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'mastery'">
          <a-tag :color="MASTERY_COLORS[record.mastery as Mastery]">
            {{ MASTERY_LABELS[record.mastery as Mastery] }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'ai'">
          <a-space @click.stop>
            <a-tag
              v-if="hasAiAnswer(record)"
              color="success"
              class="ai-tag"
              @click="openPreview(record)"
            >
              已有 AI 答案
            </a-tag>
            <a-button
              size="small"
              :type="hasAiAnswer(record) ? 'default' : 'primary'"
              :loading="aiLoadingId === record._id"
              @click="generateAi(record, $event)"
            >
              {{ hasAiAnswer(record) ? '重新作答' : 'AI 作答' }}
            </a-button>
          </a-space>
        </template>
        <template v-else-if="column.key === 'tags'">
          <a-tag v-for="tag in record.tags" :key="tag">{{ tag }}</a-tag>
        </template>
      </template>
    </a-table>

    <a-modal
      v-model:open="previewOpen"
      :title="previewQuestion?.title"
      width="720px"
      :footer="null"
    >
      <template v-if="previewQuestion?.aiAnswer">
        <div class="markdown" v-html="renderMarkdown(previewQuestion.aiAnswer)" />
        <a-button
          type="link"
          style="padding-left: 0; margin-top: 12px"
          @click="openDetail(previewQuestion!._id)"
        >
          进入题目详情 →
        </a-button>
      </template>
    </a-modal>

    <a-modal v-model:open="modalOpen" title="新建题目" @ok="createQuestion">
      <a-form layout="vertical">
        <a-form-item label="标题" required>
          <a-input v-model:value="form.title" />
        </a-form-item>
        <a-form-item label="分类">
          <a-select v-model:value="form.categorySlug">
            <a-select-option v-for="c in categories" :key="c.slug" :value="c.slug">
              {{ c.name }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="题目描述（可选）">
          <a-textarea v-model:value="form.content" :rows="3" />
        </a-form-item>
        <a-form-item label="标签（逗号分隔）">
          <a-input v-model:value="form.tags" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.ai-tag {
  cursor: pointer;
}

.markdown :deep(pre) {
  background: #f6f8fa;
  padding: 12px;
  overflow-x: auto;
  border-radius: 6px;
}

.markdown :deep(code) {
  background: #f6f8fa;
  padding: 2px 6px;
  border-radius: 4px;
}
</style>
