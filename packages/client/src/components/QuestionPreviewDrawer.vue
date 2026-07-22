<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import axios from 'axios';
import { api, MASTERY_LABELS } from '../api';
import { useCategories } from '../composables/useCategories';
import MarkdownContent from './MarkdownContent.vue';
import RichTextEditor from './RichTextEditor.vue';
import type { Mastery, Question } from '../types';

const props = defineProps<{
  open: boolean;
  question: Question | null;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  updated: [question: Question];
}>();

const router = useRouter();
const { categories, loadCategories } = useCategories();

const mastery = ref<Mastery>('new');
const notes = ref('');
const saving = ref(false);

function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    return Array.isArray(msg) ? msg.join(', ') : (msg ?? err.message);
  }
  return err instanceof Error ? err.message : '请求失败';
}

function categoryLabel(slug: string) {
  return categories.value.find((c) => c.slug === slug)?.name ?? slug;
}

function syncForm(record: Question) {
  mastery.value = record.mastery;
  notes.value = record.myNotes ?? '';
}

watch(
  () => props.question,
  (record) => {
    if (record) syncForm(record);
  },
  { immediate: true },
);

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      loadCategories();
      if (props.question) syncForm(props.question);
    }
  },
);

function close() {
  emit('update:open', false);
}

async function save() {
  if (!props.question) return;
  saving.value = true;
  try {
    const updated = await api.updateQuestion(props.question._id, {
      myNotes: notes.value,
      mastery: mastery.value,
    });
    emit('updated', updated);
    message.success('已保存');
  } catch (err) {
    message.error(getErrorMessage(err));
    if (props.question) syncForm(props.question);
  } finally {
    saving.value = false;
  }
}

function goDetail() {
  if (!props.question) return;
  close();
  router.push(`/questions/${props.question._id}`);
}
</script>

<template>
  <a-drawer
    :open="open"
    :title="question?.title"
    width="560"
    placement="right"
    root-class-name="question-preview-drawer"
    :body-style="{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }"
    @close="close"
  >
    <template v-if="question">
      <div class="drawer-layout">
        <div class="drawer-meta">
          <a-tag>{{ categoryLabel(question.categorySlug) }}</a-tag>
          <a-select
            v-model:value="mastery"
            size="small"
            class="mastery-select"
            :loading="saving"
            @change="save"
          >
            <a-select-option value="new">{{ MASTERY_LABELS.new }}</a-select-option>
            <a-select-option value="reviewing">{{ MASTERY_LABELS.reviewing }}</a-select-option>
            <a-select-option value="mastered">{{ MASTERY_LABELS.mastered }}</a-select-option>
          </a-select>
          <a-tag v-for="company in question.companies" :key="company" color="blue">{{ company }}</a-tag>
          <a-tag v-for="tag in question.tags" :key="tag">{{ tag }}</a-tag>
        </div>

        <div class="drawer-body">
          <section v-if="question.content" class="block">
            <h4 class="block-title">题目描述</h4>
            <MarkdownContent :content="question.content" />
          </section>

          <section class="block">
            <h4 class="block-title">我的笔记</h4>
            <RichTextEditor
              v-model="notes"
              :min-height="160"
              placeholder="记录你的思路与答案要点，支持粘贴或上传图片..."
            />
            <a-button type="primary" size="small" :loading="saving" @click="save" style="margin-top: 8px">
              保存笔记
            </a-button>
          </section>

          <section class="block">
            <h4 class="block-title">AI 参考答案</h4>
            <a-empty v-if="!question.aiAnswer?.trim()" description="暂无 AI 参考答案" />
            <MarkdownContent v-else :content="question.aiAnswer" />
          </section>
        </div>
      </div>
    </template>

    <template #footer>
      <a-button type="primary" block @click="goDetail">进入题目详情</a-button>
    </template>
  </a-drawer>
</template>

<style scoped>
.drawer-layout {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.drawer-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border-bottom: 1px solid #f0f0f0;
  background: #fafafa;
  flex-shrink: 0;
}

.mastery-select {
  width: 108px;
}

.drawer-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 24px 24px;
}

.block {
  padding-top: 20px;
}

.block + .block {
  margin-top: 4px;
  padding-top: 20px;
  border-top: 1px solid #f0f0f0;
}

.block-title {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: #262626;
  line-height: 1.4;
}

.block :deep(.ant-input) {
  margin-bottom: 8px;
}

.markdown :deep(p) {
  margin: 0 0 0.75em;
}

.markdown :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown :deep(ul),
.markdown :deep(ol) {
  margin: 0 0 0.75em;
  padding-left: 1.5em;
}

.markdown :deep(h1),
.markdown :deep(h2),
.markdown :deep(h3),
.markdown :deep(h4) {
  margin: 1em 0 0.5em;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
}

.markdown :deep(h1:first-child),
.markdown :deep(h2:first-child),
.markdown :deep(h3:first-child),
.markdown :deep(h4:first-child) {
  margin-top: 0;
}

.markdown :deep(pre) {
  background: #f6f8fa;
  padding: 12px;
  overflow-x: auto;
  border-radius: 6px;
  margin: 0 0 0.75em;
}

.markdown :deep(code) {
  background: #f6f8fa;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
}

.markdown :deep(pre code) {
  padding: 0;
  background: none;
}
</style>

<style>
.question-preview-drawer .ant-drawer-content {
  display: flex;
  flex-direction: column;
}

.question-preview-drawer .ant-drawer-body {
  flex: 1;
  min-height: 0;
}
</style>
