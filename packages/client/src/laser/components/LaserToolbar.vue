<script setup lang="ts">
import { ref } from 'vue';
import type { EditorMode } from '../types';

defineProps<{
  mode: EditorMode;
  selectedCount: number;
  objectCount: number;
  playing: boolean;
  progress: number;
}>();

const emit = defineEmits<{
  addRect: [];
  addEllipse: [];
  addLine: [];
  addText: [];
  deleteSelected: [];
  clearAll: [];
  importFile: [file: File];
  exportSvg: [];
  exportJson: [];
  startPreview: [];
  exitPreview: [];
  play: [];
  pause: [];
  reset: [];
}>();

const fileInputRef = ref<HTMLInputElement | null>(null);

function openImportPicker() {
  fileInputRef.value?.click();
}

function onImportChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) emit('importFile', file);
  input.value = '';
}
</script>

<template>
  <div class="laser-toolbar">
    <template v-if="mode === 'edit'">
      <a-space wrap>
        <a-button @click="emit('addRect')">矩形</a-button>
        <a-button @click="emit('addEllipse')">椭圆</a-button>
        <a-button @click="emit('addLine')">直线</a-button>
        <a-button @click="emit('addText')">文字</a-button>
        <a-button danger @click="emit('deleteSelected')">删除选中</a-button>
        <a-button @click="emit('clearAll')">清空</a-button>
        <a-button @click="openImportPicker">导入</a-button>
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*,.svg,image/svg+xml"
          hidden
          @change="onImportChange"
        />
        <a-button @click="emit('exportSvg')">导出 SVG</a-button>
        <a-button @click="emit('exportJson')">导出 JSON</a-button>
        <a-button type="primary" @click="emit('startPreview')">开始模拟</a-button>
      </a-space>
    </template>
    <template v-else>
      <a-space wrap>
        <a-button type="primary" :disabled="playing" @click="emit('play')">播放</a-button>
        <a-button :disabled="!playing" @click="emit('pause')">暂停</a-button>
        <a-button @click="emit('reset')">重播</a-button>
        <a-button @click="emit('exitPreview')">退出模拟</a-button>
        <span class="meta">进度 {{ Math.round(progress * 100) }}%</span>
      </a-space>
    </template>
    <div class="meta">
      模式：{{ mode === 'edit' ? '编辑' : '预览' }} · 选中 {{ selectedCount }} · 对象
      {{ objectCount }}
    </div>
  </div>
</template>

<style scoped>
.laser-toolbar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}
.meta {
  color: #8c8c8c;
  font-size: 13px;
}
</style>
