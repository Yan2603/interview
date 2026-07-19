<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, RouterView } from 'vue-router';
import zhCN from 'ant-design-vue/es/locale/zh_CN';
import AppLayout from './components/layout/AppLayout.vue';

const route = useRoute();
// 登录页无需侧边栏导航，独立于 AppLayout 的菜单外壳渲染
const isStandalone = computed(() => route.path === '/login');
</script>

<template>
  <a-config-provider :locale="zhCN">
    <RouterView v-if="isStandalone" />
    <AppLayout v-else />
  </a-config-provider>
</template>

<style>
body {
  margin: 0;
  background: #f5f5f5;
}
</style>
