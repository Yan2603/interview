<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter, RouterView } from 'vue-router';
import zhCN from 'ant-design-vue/es/locale/zh_CN';
import AppLayout from './components/layout/AppLayout.vue';

const route = useRoute();
const router = useRouter();

/** Wait for initial navigation (incl. auth beforeEach) so AppLayout never flashes before /login. */
const bootReady = ref(false);
void router.isReady().then(() => {
  bootReady.value = true;
});

const isStandalone = computed(() => route.path === '/login');
</script>

<template>
  <a-config-provider :locale="zhCN">
    <div v-if="!bootReady" class="app-boot" aria-busy="true" aria-label="加载中" />
    <RouterView v-else-if="isStandalone" />
    <AppLayout v-else />
  </a-config-provider>
</template>

<style>
html,
body,
#app {
  height: 100%;
  margin: 0;
  overflow: hidden;
}

body {
  background: #f5f5f5;
}

#app > * {
  height: 100%;
}

.app-boot {
  height: 100%;
  background: #f5f5f5;
}

/* 全局滚动条：细、浅、hover 才略加深 */
* {
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.18) transparent;
}

*::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

*::-webkit-scrollbar-track {
  background: transparent;
}

*::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.16);
  border-radius: 999px;
  border: 1px solid transparent;
  background-clip: content-box;
}

*::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0, 0, 0, 0.32);
}

*::-webkit-scrollbar-corner {
  background: transparent;
}
</style>
