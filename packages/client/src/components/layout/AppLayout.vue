<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter, RouterView } from 'vue-router';
import { Grid, message } from 'ant-design-vue';
import { MenuOutlined } from '@ant-design/icons-vue';
import axios from 'axios';
import { useAuthStore } from '../../auth/authStore';
import { useCategories } from '../../composables/useCategories';
import type { Category } from '../../types';
import AppSiderPanel from './AppSiderPanel.vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { categories, loadCategories, createCategory, updateCategory, deleteCategory } = useCategories();

const categoryModalOpen = ref(false);
const editingCategoryId = ref<string | null>(null);
const categoryForm = ref({ name: '', slug: '' });
const categorySaving = ref(false);
const mobileNavOpen = ref(false);

const isEditingCategory = computed(() => Boolean(editingCategoryId.value));

/** < lg(992px)：侧栏改为抽屉，避免挤占主内容 */
const screens = Grid.useBreakpoint();
const isNarrow = computed(() => {
  if (screens.value.lg === undefined) return false;
  return !screens.value.lg;
});

onMounted(async () => {
  await loadCategories();
  if (auth.isAuthenticated && !auth.user) {
    try {
      await auth.fetchMe();
    } catch {
      // ignore — interceptor / ensureSession handles session loss
    }
  }
});

watch(
  () => route.fullPath,
  () => {
    mobileNavOpen.value = false;
  },
);

watch(isNarrow, (narrow) => {
  if (!narrow) mobileNavOpen.value = false;
});

async function onLogout() {
  await auth.logout();
  router.push('/login');
}

const mainSelectedKeys = computed(() => {
  if (route.path.startsWith('/questions')) return ['questions'];
  if (route.path.startsWith('/calendar')) return ['calendar'];
  if (route.path.startsWith('/laser')) return ['laser'];
  if (route.path.startsWith('/chat')) return ['chat'];
  if (route.path.startsWith('/knowledge/questions')) return ['knowledge-questions'];
  if (route.path.startsWith('/knowledge/milvus')) return ['knowledge-milvus'];
  if (route.path.startsWith('/knowledge')) return ['knowledge-documents'];
  return ['dashboard'];
});

const openKeys = ref<string[]>([]);

const siderOpenKeys = computed({
  get() {
    const keys = [...openKeys.value];
    if (route.path.startsWith('/knowledge') && !keys.includes('knowledge')) {
      keys.push('knowledge');
    }
    return keys;
  },
  set(keys: string[]) {
    openKeys.value = keys;
  },
});

/** 聊天 / 题库列表自带内层滚动，右侧 content 不再二次滚动 */
const isFixedContentRoute = computed(
  () => route.path.startsWith('/chat') || route.path === '/questions',
);

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
    <a-layout class="app-shell">
      <a-layout-sider
        v-if="!isNarrow"
        width="220"
        theme="light"
        class="app-sider"
      >
        <AppSiderPanel
          :categories="categories"
          :main-selected-keys="mainSelectedKeys"
          :category-selected-keys="categorySelectedKeys"
          v-model:open-keys="siderOpenKeys"
          :username="auth.user?.username"
          @go-category="goCategory"
          @add-category="openCategoryModal"
          @edit-category="openEditCategoryModal"
          @remove-category="removeCategory"
          @logout="onLogout"
        />
      </a-layout-sider>

      <a-layout class="app-main">
        <header v-if="isNarrow" class="mobile-topbar">
          <button
            type="button"
            class="mobile-menu-btn"
            aria-label="打开导航菜单"
            @click="mobileNavOpen = true"
          >
            <MenuOutlined />
          </button>
          <div class="mobile-brand">
            <img src="/favicon.svg" alt="" class="mobile-brand-icon" />
            <span class="mobile-brand-text">面试驾驶舱</span>
          </div>
        </header>
        <a-layout-content class="content" :class="{ 'content--fixed': isFixedContentRoute }">
          <RouterView />
        </a-layout-content>
      </a-layout>
    </a-layout>

    <a-drawer
      v-if="isNarrow"
      v-model:open="mobileNavOpen"
      placement="left"
      :width="280"
      :closable="false"
      :body-style="{ padding: 0, height: '100%' }"
    >
      <AppSiderPanel
        :categories="categories"
        :main-selected-keys="mainSelectedKeys"
        :category-selected-keys="categorySelectedKeys"
        v-model:open-keys="siderOpenKeys"
        :username="auth.user?.username"
        @go-category="goCategory"
        @add-category="openCategoryModal"
        @edit-category="openEditCategoryModal"
        @remove-category="removeCategory"
        @logout="onLogout"
      />
    </a-drawer>

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
.app-layout {
  height: 100%;
  overflow: hidden;
}

.app-shell {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.app-sider {
  height: 100% !important;
  overflow: hidden !important;
  border-right: 1px solid #f0f0f0;
}

.app-sider :deep(.ant-layout-sider-children) {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.app-main {
  height: 100%;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.mobile-topbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 52px;
  padding: 0 12px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
}

.mobile-menu-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #262626;
  font-size: 18px;
  cursor: pointer;
}

.mobile-menu-btn:hover {
  background: #f5f5f5;
}

.mobile-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.mobile-brand-icon {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}

.mobile-brand-text {
  font-size: 15px;
  font-weight: 600;
  color: #262626;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.content {
  flex: 1 1 0;
  height: auto;
  min-height: 0;
  min-width: 0;
  padding: 24px;
  overflow-x: hidden;
  overflow-y: auto;
  box-sizing: border-box;
}

/* 聊天、题库列表等自带内层滚动的页面：右侧外壳不再滚 */
.content--fixed {
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.content--fixed :deep(> *) {
  flex: 1 1 0;
  min-height: 0;
  min-width: 0;
}

@media (max-width: 991px) {
  .content:not(.content--fixed) {
    padding: 16px;
  }
}
</style>
