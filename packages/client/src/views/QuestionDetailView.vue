<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import axios from 'axios';
import { api, MASTERY_LABELS } from '../api';
import { useCategories } from '../composables/useCategories';
import { useTags } from '../composables/useTags';
import { renderMarkdown } from '../utils/markdown';
import type { Mastery, Question } from '../types';

const route = useRoute();
const router = useRouter();
const { categories, loadCategories } = useCategories();
const { loadTags, tagOptions } = useTags();

const loading = ref(true);
const aiLoading = ref(false);
const saving = ref(false);
const editing = ref(false);
const question = ref<Question | null>(null);
const myNotes = ref('');
const mastery = ref<Mastery>('new');
const editForm = ref({ title: '', categorySlug: '', content: '', tags: [] as string[] });

const editTagOptions = computed(() => tagOptions(editForm.value.tags));

const categoryLabel = computed(() => {
  if (!question.value) return '';
  return categories.value.find((c) => c.slug === question.value!.categorySlug)?.name
    ?? question.value.categorySlug;
});

function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    return Array.isArray(msg) ? msg.join(', ') : (msg ?? err.message);
  }
  return err instanceof Error ? err.message : '请求失败';
}

function syncEditForm() {
  if (!question.value) return;
  editForm.value = {
    title: question.value.title,
    categorySlug: question.value.categorySlug,
    content: question.value.content ?? '',
    tags: [...(question.value.tags ?? [])],
  };
}

async function load() {
  loading.value = true;
  try {
    await loadCategories();
    await loadTags();
    question.value = await api.getQuestion(route.params.id as string);
    myNotes.value = question.value.myNotes;
    mastery.value = question.value.mastery;
    syncEditForm();
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function startEdit() {
  syncEditForm();
  editing.value = true;
}

function cancelEdit() {
  editing.value = false;
  syncEditForm();
}

async function saveMeta() {
  if (!question.value) return;
  if (!editForm.value.title.trim()) {
    message.warning('请填写题目标题');
    return;
  }
  saving.value = true;
  try {
    question.value = await api.updateQuestion(question.value._id, {
      title: editForm.value.title.trim(),
      categorySlug: editForm.value.categorySlug,
      content: editForm.value.content,
      tags: editForm.value.tags,
    });
    editing.value = false;
    message.success('题目信息已保存');
  } catch (err) {
    message.error(getErrorMessage(err));
  } finally {
    saving.value = false;
  }
}

async function saveNotes() {
  if (!question.value) return;
  saving.value = true;
  try {
    question.value = await api.updateQuestion(question.value._id, {
      myNotes: myNotes.value,
      mastery: mastery.value,
    });
    message.success('已保存');
  } catch (err) {
    message.error(getErrorMessage(err));
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
    message.error(getErrorMessage(err));
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
          <a-button v-if="!editing" @click="startEdit">编辑题目</a-button>
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

      <template v-if="editing">
        <a-card title="编辑题目信息">
          <a-form layout="vertical">
            <a-form-item label="标题" required>
              <a-input v-model:value="editForm.title" />
            </a-form-item>
            <a-form-item label="分类">
              <a-select v-model:value="editForm.categorySlug">
                <a-select-option v-for="c in categories" :key="c.slug" :value="c.slug">
                  {{ c.name }}
                </a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item label="题目描述">
              <a-textarea v-model:value="editForm.content" :rows="4" />
            </a-form-item>
            <a-form-item label="标签">
              <a-select
                v-model:value="editForm.tags"
                mode="multiple"
                placeholder="选择标签"
                :options="editTagOptions"
                style="width: 100%"
              />
            </a-form-item>
            <a-space>
              <a-button type="primary" :loading="saving" @click="saveMeta">保存</a-button>
              <a-button @click="cancelEdit">取消</a-button>
            </a-space>
          </a-form>
        </a-card>
      </template>

      <template v-else>
        <h2>{{ question.title }}</h2>
        <a-tag>{{ categoryLabel }}</a-tag>
        <a-tag v-for="tag in question.tags" :key="tag">{{ tag }}</a-tag>

        <a-card v-if="question.content" title="题目描述" style="margin-top: 16px">
          <div class="markdown" v-html="renderMarkdown(question.content)" />
        </a-card>
      </template>

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
