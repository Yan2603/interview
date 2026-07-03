<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter, RouterView } from 'vue-router';
import { message } from 'ant-design-vue';
import axios from 'axios';
import { useCategories } from '../../composables/useCategories';
import type { Category } from '../../types';

const route = useRoute();
const router = useRouter();
const { categories, loadCategories, createCategory, updateCategory, deleteCategory } = useCategories();

const categoryModalOpen = ref(false);
const editingCategoryId = ref<string | null>(null);
const categoryForm = ref({ name: '', slug: '' });
const categorySaving = ref(false);

const isEditingCategory = computed(() => Boolean(editingCategoryId.value));

onMounted(loadCategories);

const mainSelectedKeys = computed(() => {
  if (route.path.startsWith('/questions')) return ['questions'];
  if (route.path.startsWith('/calendar')) return ['calendar'];
  return ['dashboard'];
});

const categorySelectedKeys = computed(() => {
  const cat = route.query.category as string | undefined;
  return cat ? [`cat-${cat}`] : [];
});

function goCategory(slug: string) {
  router.push({ path: '/questions', query: { category: slug } });
}

function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    return Array.isArray(msg) ? msg.join(', ') : (msg ?? err.message);
  }
  return err instanceof Error ? err.message : '请求失败';
}

function openCategoryModal() {
  editingCategoryId.value = null;
  categoryForm.value = { name: '', slug: '' };
  categoryModalOpen.value = true;
}

function openEditCategoryModal(cat: Category, event?: Event) {
  event?.stopPropagation();
  editingCategoryId.value = cat._id;
  categoryForm.value = { name: cat.name, slug: cat.slug };
  categoryModalOpen.value = true;
}

async function submitCategory() {
  const { name, slug } = categoryForm.value;
  if (!name.trim()) {
    message.warning('请填写分类名称');
    return;
  }
  if (!isEditingCategory.value && !slug.trim()) {
    message.warning('请填写分类标识');
    return;
  }
  categorySaving.value = true;
  try {
    if (editingCategoryId.value) {
      await updateCategory(editingCategoryId.value, { name: name.trim() });
      message.success('分类已更新');
    } else {
      await createCategory({ name: name.trim(), slug: slug.trim() });
      message.success('分类已添加');
    }
    categoryModalOpen.value = false;
    editingCategoryId.value = null;
  } catch (err) {
    message.error(getErrorMessage(err));
  } finally {
    categorySaving.value = false;
  }
}

async function removeCategory(cat: Category) {
  try {
    await deleteCategory(cat._id);
    message.success('分类已删除');
    if (route.query.category === cat.slug) {
      router.push({ path: '/questions' });
    }
  } catch (err) {
    message.error(getErrorMessage(err));
  }
}
</script>

<template>
  <div class="app-layout">
    <a-layout style="min-height: 100vh">
    <a-layout-sider width="220" theme="light" style="border-right: 1px solid #f0f0f0">
      <div class="logo">
        <img src="/favicon.svg" alt="" class="logo-icon" />
        <span class="logo-text">面试驾驶舱</span>
      </div>
      <a-menu
        mode="inline"
        :selected-keys="[...mainSelectedKeys, ...categorySelectedKeys]"
        style="border: none"
      >
        <a-menu-item key="dashboard">
          <router-link to="/">概览</router-link>
        </a-menu-item>
        <a-menu-item key="questions">
          <router-link to="/questions">题库</router-link>
        </a-menu-item>
        <a-menu-item key="calendar">
          <router-link to="/calendar">日历</router-link>
        </a-menu-item>

        <a-menu-divider />

        <a-menu-item-group>
          <template #title>
            <span class="category-group-title">
              分类
              <a-button type="link" size="small" class="add-category-btn" @click.stop="openCategoryModal">
                + 添加
              </a-button>
            </span>
          </template>
          <a-menu-item
            v-for="cat in categories"
            :key="`cat-${cat.slug}`"
            @click="goCategory(cat.slug)"
          >
            <span class="category-item">
              <span class="category-name">{{ cat.name }}</span>
              <span class="category-actions" @click.stop>
                <span
                  class="category-edit"
                  title="编辑分类"
                  @click="openEditCategoryModal(cat, $event)"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm2.92 2.83H5v-.92l9.06-9.06.92.92L5.92 20.08zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                    />
                  </svg>
                </span>
                <a-popconfirm
                  title="确定删除该分类？"
                  ok-text="删除"
                  cancel-text="取消"
                  @confirm="removeCategory(cat)"
                >
                  <span class="category-delete">×</span>
                </a-popconfirm>
              </span>
            </span>
          </a-menu-item>
        </a-menu-item-group>
      </a-menu>
    </a-layout-sider>

    <a-layout>
      <a-layout-content class="content">
        <RouterView />
      </a-layout-content>
    </a-layout>
  </a-layout>

  <a-modal
    v-model:open="categoryModalOpen"
    :title="isEditingCategory ? '编辑分类' : '添加分类'"
    :confirm-loading="categorySaving"
    @ok="submitCategory"
  >
    <a-form layout="vertical">
      <a-form-item label="名称" required>
        <a-input v-model:value="categoryForm.name" placeholder="如：React" />
      </a-form-item>
      <a-form-item
        v-if="!isEditingCategory"
        label="标识（slug）"
        required
        extra="英文小写，用于 URL 筛选，创建后不可修改"
      >
        <a-input v-model:value="categoryForm.slug" placeholder="如：react" />
      </a-form-item>
      <a-form-item v-else label="标识（slug）">
        <a-input :value="categoryForm.slug" disabled />
      </a-form-item>
    </a-form>
  </a-modal>
  </div>
</template>

<style scoped>
.logo {
  height: 64px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px;
  border-bottom: 1px solid #f0f0f0;
}

.logo-icon {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}

.logo-text {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.2;
  color: #262626;
}

.content {
  padding: 24px;
  min-height: 100vh;
}

a {
  color: inherit;
  text-decoration: none;
}

.category-group-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.add-category-btn {
  padding: 0;
  height: auto;
  font-size: 12px;
}

.category-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.category-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-actions {
  display: none;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.category-edit,
.category-delete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  color: #999;
  cursor: pointer;
  flex-shrink: 0;
}

.category-edit svg {
  width: 13px;
  height: 13px;
  fill: currentColor;
}

.category-edit:hover {
  color: #1677ff;
  background: #e6f4ff;
}

.category-delete {
  font-size: 16px;
  line-height: 1;
}

.category-delete:hover {
  color: #ff4d4f;
  background: #fff1f0;
}

:deep(.ant-menu-item:hover) .category-actions {
  display: inline-flex;
}
</style>
