<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter, RouterView } from 'vue-router';
import { api } from '../../api';
import type { Category } from '../../types';

const route = useRoute();
const router = useRouter();
const categories = ref<Category[]>([]);

onMounted(async () => {
  categories.value = await api.getCategories();
});

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
</script>

<template>
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

        <a-menu-item-group title="分类">
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
</style>
