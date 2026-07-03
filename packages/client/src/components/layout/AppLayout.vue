<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter, RouterView } from 'vue-router';
import { message } from 'ant-design-vue';
import axios from 'axios';
import { useCategories } from '../../composables/useCategories';

const route = useRoute();
const router = useRouter();
const { categories, loadCategories, createCategory } = useCategories();

const categoryModalOpen = ref(false);
const categoryForm = ref({ name: '', slug: '' });
const categorySaving = ref(false);

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
  categoryForm.value = { name: '', slug: '' };
  categoryModalOpen.value = true;
}

async function submitCategory() {
  const { name, slug } = categoryForm.value;
  if (!name.trim() || !slug.trim()) {
    message.warning('请填写分类名称和标识');
    return;
  }
  categorySaving.value = true;
  try {
    await createCategory({ name: name.trim(), slug: slug.trim() });
    categoryModalOpen.value = false;
    message.success('分类已添加');
  } catch (err) {
    message.error(getErrorMessage(err));
  } finally {
    categorySaving.value = false;
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
            {{ cat.name }}
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
    title="添加分类"
    :confirm-loading="categorySaving"
    @ok="submitCategory"
  >
    <a-form layout="vertical">
      <a-form-item label="名称" required>
        <a-input v-model:value="categoryForm.name" placeholder="如：React" />
      </a-form-item>
      <a-form-item label="标识（slug）" required extra="英文小写，用于 URL 筛选，创建后不可修改">
        <a-input v-model:value="categoryForm.slug" placeholder="如：react" />
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
</style>
