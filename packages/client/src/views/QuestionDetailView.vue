<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import { api, MASTERY_LABELS } from '../api';
import { renderMarkdown } from '../utils/markdown';
import type { Mastery, Question } from '../types';

const route = useRoute();
const router = useRouter();
const loading = ref(true);
const aiLoading = ref(false);
const saving = ref(false);
const question = ref<Question | null>(null);
const myNotes = ref('');
const mastery = ref<Mastery>('new');

async function load() {
  loading.value = true;
  try {
    question.value = await api.getQuestion(route.params.id as string);
    myNotes.value = question.value.myNotes;
    mastery.value = question.value.mastery;
  } finally {
    loading.value = false;
  }
}

onMounted(load);

async function saveNotes() {
  if (!question.value) return;
  saving.value = true;
  try {
    question.value = await api.updateQuestion(question.value._id, {
      myNotes: myNotes.value,
      mastery: mastery.value,
    });
    message.success('已保存');
  } finally {
    saving.value = false;
  }
}

async function generateAi(mode: 'standard' | 'deep') {
  if (!question.value) return;
  aiLoading.value = true;
  try {
    const { aiAnswer } = await api.generateAiAnswer(question.value._id, mode);
    question.value = { ...question.value, aiAnswer };
    message.success('AI 作答完成');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'AI 请求失败';
    message.error(msg);
  } finally {
    aiLoading.value = false;
  }
}

async function removeQuestion() {
  if (!question.value) return;
  await api.deleteQuestion(question.value._id);
  message.success('已删除');
  router.push('/questions');
}
</script>

<template>
  <a-spin :spinning="loading">
    <template v-if="question">
      <div class="toolbar">
        <a-button @click="router.back()">返回</a-button>
        <a-space>
          <a-select v-model:value="mastery" style="width: 120px" @change="saveNotes">
            <a-select-option value="new">{{ MASTERY_LABELS.new }}</a-select-option>
            <a-select-option value="reviewing">{{ MASTERY_LABELS.reviewing }}</a-select-option>
            <a-select-option value="mastered">{{ MASTERY_LABELS.mastered }}</a-select-option>
          </a-select>
          <a-popconfirm title="确定删除？" @confirm="removeQuestion">
            <a-button danger>删除</a-button>
          </a-popconfirm>
        </a-space>
      </div>

      <h2>{{ question.title }}</h2>
      <a-tag>{{ question.categorySlug }}</a-tag>
      <a-tag v-for="tag in question.tags" :key="tag">{{ tag }}</a-tag>

      <a-card v-if="question.content" title="题目描述" style="margin-top: 16px">
        <div class="markdown" v-html="renderMarkdown(question.content)" />
      </a-card>

      <a-card title="我的笔记" style="margin-top: 16px">
        <a-textarea v-model:value="myNotes" :rows="6" placeholder="记录你的思路与答案要点..." />
        <a-button type="primary" style="margin-top: 12px" :loading="saving" @click="saveNotes">
          保存笔记
        </a-button>
      </a-card>

      <a-card title="AI 参考答案" style="margin-top: 16px">
        <a-space style="margin-bottom: 16px">
          <a-button type="primary" :loading="aiLoading" @click="generateAi('standard')">
            AI 生成答案
          </a-button>
          <a-button :loading="aiLoading" @click="generateAi('deep')">加深版</a-button>
        </a-space>
        <a-spin :spinning="aiLoading">
          <a-empty v-if="!question.aiAnswer" description="点击上方按钮生成 AI 参考答案" />
          <div v-else class="markdown" v-html="renderMarkdown(question.aiAnswer)" />
        </a-spin>
      </a-card>
    </template>
  </a-spin>
</template>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
}

.markdown :deep(h1),
.markdown :deep(h2),
.markdown :deep(h3) {
  margin-top: 1em;
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
