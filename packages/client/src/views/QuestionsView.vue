<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import { api, MASTERY_COLORS, MASTERY_LABELS } from '../api';
import { useCategories } from '../composables/useCategories';
import { useTags } from '../composables/useTags';
import QuestionPreviewDrawer from '../components/QuestionPreviewDrawer.vue';
import MarkdownContent from '../components/MarkdownContent.vue';
import { getErrorMessage, createDebouncedSearch } from '../utils/error';
import type { Mastery, Question, Tag } from '../types';

const route = useRoute();
const router = useRouter();
const { categories, loadCategories } = useCategories();
const { tags, loadTags, tagOptions, createTag, updateTag, deleteTag } = useTags();

const loading = ref(false);
const questions = ref<Question[]>([]);
const search = ref('');
const mastery = ref<Mastery | undefined>();
const aiLoadingId = ref<string | null>(null);
const drawerOpen = ref(false);
const drawerQuestion = ref<Question | null>(null);
const aiPreviewOpen = ref(false);
const aiPreviewQuestion = ref<Question | null>(null);

const categoryFilter = computed(() => route.query.category as string | undefined);

const categoryName = computed(() => {
  if (!categoryFilter.value) return '全部题目';
  return categories.value.find((c) => c.slug === categoryFilter.value)?.name ?? categoryFilter.value;
});

const modalOpen = ref(false);
const editingId = ref<string | null>(null);
const form = ref({ title: '', categorySlug: 'vue3', content: '', tags: [] as string[] });

const isEditing = computed(() => Boolean(editingId.value));
const formTagOptions = computed(() => tagOptions(form.value.tags));

const tagModalOpen = ref(false);
const newTagName = ref('');
const tagSaving = ref(false);
const editingTagId = ref<string | null>(null);
const editingTagName = ref('');

function hasAiAnswer(record: Question) {
  return Boolean(record.aiAnswer?.trim());
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

// 使用防抖优化搜索
const debouncedSearch = createDebouncedSearch(load, 500);

onMounted(async () => {
  await Promise.all([loadCategories(), loadTags()]);
  form.value.categorySlug = categoryFilter.value ?? categories.value[0]?.slug ?? 'vue3';
  await load();
});

watch([() => route.query.category, mastery], load);

async function onSearch() {
  debouncedSearch();
}

function openCreateModal() {
  editingId.value = null;
  form.value = {
    title: '',
    categorySlug: categoryFilter.value ?? categories.value[0]?.slug ?? 'vue3',
    content: '',
    tags: [],
  };
  modalOpen.value = true;
}

function openEditModal(record: Question, event?: Event) {
  event?.stopPropagation();
  editingId.value = record._id;
  form.value = {
    title: record.title,
    categorySlug: record.categorySlug,
    content: record.content ?? '',
    tags: [...(record.tags ?? [])],
  };
  modalOpen.value = true;
}

async function submitQuestion() {
  if (!form.value.title.trim()) {
    message.warning('请填写题目标题');
    return;
  }
  const payload = {
    title: form.value.title.trim(),
    categorySlug: form.value.categorySlug,
    content: form.value.content,
    tags: form.value.tags,
  };
  try {
    if (editingId.value) {
      await api.updateQuestion(editingId.value, payload);
      message.success('题目已更新');
    } else {
      await api.createQuestion(payload);
      message.success('题目已创建');
    }
    modalOpen.value = false;
    editingId.value = null;
    await load();
  } catch (err) {
    message.error(getErrorMessage(err));
  }
}

function openDetail(id: string, event?: Event) {
  event?.stopPropagation();
  router.push(`/questions/${id}`);
}

function openDrawer(record: Question) {
  drawerQuestion.value = record;
  drawerOpen.value = true;
}

function openAiPreview(record: Question, event?: Event) {
  event?.stopPropagation();
  aiPreviewQuestion.value = record;
  aiPreviewOpen.value = true;
}

function handleDrawerUpdated(updated: Question) {
  drawerQuestion.value = updated;
  const idx = questions.value.findIndex((q) => q._id === updated._id);
  if (idx >= 0) {
    questions.value[idx] = updated;
  }
  if (mastery.value && updated.mastery !== mastery.value) {
    load();
  }
}

async function generateAi(record: Question, event?: Event) {
  event?.stopPropagation();
  aiLoadingId.value = record._id;
  try {
    const { aiAnswer } = await api.generateAiAnswer(record._id);
    const updated = { ...record, aiAnswer };
    const idx = questions.value.findIndex((q) => q._id === record._id);
    if (idx >= 0) {
      questions.value[idx] = updated;
    }
    drawerQuestion.value = updated;
    aiPreviewQuestion.value = updated;
    aiPreviewOpen.value = true;
    message.success('AI 作答完成');
  } catch (err) {
    message.error(getErrorMessage(err));
  } finally {
    aiLoadingId.value = null;
  }
}

function categoryLabel(slug: string) {
  return categories.value.find((c) => c.slug === slug)?.name ?? slug;
}

async function openTagModal() {
  await loadTags();
  newTagName.value = '';
  editingTagId.value = null;
  editingTagName.value = '';
  tagModalOpen.value = true;
}

async function submitNewTag() {
  const name = newTagName.value.trim();
  if (!name) {
    message.warning('请填写标签名称');
    return;
  }
  tagSaving.value = true;
  try {
    await createTag(name);
    newTagName.value = '';
    message.success('标签已添加');
  } catch (err) {
    message.error(getErrorMessage(err));
  } finally {
    tagSaving.value = false;
  }
}

function startEditTag(tag: Tag) {
  editingTagId.value = tag._id;
  editingTagName.value = tag.name;
}

function cancelEditTag() {
  editingTagId.value = null;
  editingTagName.value = '';
}

async function saveEditTag() {
  if (!editingTagId.value) return;
  const name = editingTagName.value.trim();
  if (!name) {
    message.warning('请填写标签名称');
    return;
  }
  tagSaving.value = true;
  try {
    await updateTag(editingTagId.value, name);
    editingTagId.value = null;
    editingTagName.value = '';
    message.success('标签已更新');
    await load();
  } catch (err) {
    message.error(getErrorMessage(err));
  } finally {
    tagSaving.value = false;
  }
}

async function removeTag(tag: Tag) {
  try {
    await deleteTag(tag._id);
    message.success('标签已删除');
  } catch (err) {
    message.error(getErrorMessage(err));
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
        <a-button @click="openTagModal">管理标签</a-button>
        <a-button type="primary" @click="openCreateModal">新建题目</a-button>
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
        { title: '操作', key: 'actions', width: 80 },
      ]"
      row-key="_id"
      :pagination="{ pageSize: 20 }"
      :custom-row="(record: Question) => ({ onClick: () => openDrawer(record), style: { cursor: 'pointer' } })"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'title'">
          <a class="question-title-link" @click="openDetail(record._id, $event)">
            {{ record.title }}
          </a>
        </template>
        <template v-else-if="column.key === 'categorySlug'">
          {{ categoryLabel(record.categorySlug) }}
        </template>
        <template v-else-if="column.key === 'mastery'">
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
              @click="openAiPreview(record, $event)"
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
        <template v-else-if="column.key === 'actions'">
          <a-button type="link" size="small" @click="openEditModal(record, $event)">编辑</a-button>
        </template>
      </template>
    </a-table>

    <QuestionPreviewDrawer
      v-model:open="drawerOpen"
      :question="drawerQuestion"
      @updated="handleDrawerUpdated"
    />

    <a-modal
      v-model:open="aiPreviewOpen"
      :title="aiPreviewQuestion?.title"
      width="720px"
      :footer="null"
    >
      <MarkdownContent
        v-if="aiPreviewQuestion?.aiAnswer"
        :content="aiPreviewQuestion.aiAnswer"
      />
      <a-button
        v-if="aiPreviewQuestion"
        type="link"
        style="padding-left: 0; margin-top: 12px"
        @click="openDetail(aiPreviewQuestion._id)"
      >
        进入题目详情 →
      </a-button>
    </a-modal>

    <a-modal
      v-model:open="modalOpen"
      :title="isEditing ? '编辑题目' : '新建题目'"
      @ok="submitQuestion"
    >
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
        <a-form-item label="标签">
          <a-select
            v-model:value="form.tags"
            mode="multiple"
            placeholder="选择标签"
            :options="formTagOptions"
            style="width: 100%"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="tagModalOpen"
      title="管理标签"
      width="520px"
      :footer="null"
    >
      <a-space style="width: 100%; margin-bottom: 16px">
        <a-input
          v-model:value="newTagName"
          placeholder="新标签名称"
          style="width: 280px"
          @press-enter="submitNewTag"
        />
        <a-button type="primary" :loading="tagSaving" @click="submitNewTag">添加</a-button>
      </a-space>

      <a-table
        :data-source="tags"
        :pagination="false"
        row-key="_id"
        size="small"
        :columns="[
          { title: '标签', key: 'name' },
          { title: '操作', key: 'actions', width: 120 },
        ]"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <a-input
              v-if="editingTagId === record._id"
              v-model:value="editingTagName"
              size="small"
              @press-enter="saveEditTag"
            />
            <span v-else>{{ record.name }}</span>
          </template>
          <template v-else-if="column.key === 'actions'">
            <a-space v-if="editingTagId === record._id">
              <a-button type="link" size="small" :loading="tagSaving" @click="saveEditTag">保存</a-button>
              <a-button type="link" size="small" @click="cancelEditTag">取消</a-button>
            </a-space>
            <a-space v-else>
              <a-button type="link" size="small" @click="startEditTag(record)">编辑</a-button>
              <a-popconfirm title="确定删除该标签？" @confirm="removeTag(record)">
                <a-button type="link" size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
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

.question-title-link {
  color: #1677ff;
  font-weight: 500;
}

.question-title-link:hover {
  color: #4096ff;
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
