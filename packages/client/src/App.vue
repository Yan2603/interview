<script setup lang="ts">
import zhCN from 'ant-design-vue/es/locale/zh_CN';
import AppLayout from './components/layout/AppLayout.vue';
</script>

<template>
  <a-config-provider :locale="zhCN">
    <AppLayout />
  </a-config-provider>
</template>

<style>
body {
  margin: 0;
  background: #f5f5f5;
}
</style>
