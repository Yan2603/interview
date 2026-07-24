<script setup lang="ts">
import { computed, ref } from 'vue';
import { message } from 'ant-design-vue';
import DesignCanvas from './components/DesignCanvas.vue';
import PreviewCanvas from './components/PreviewCanvas.vue';
import LaserToolbar from './components/LaserToolbar.vue';
import { buildLaserPaths } from './composables/useLaserPaths';
import { buildExportFilename, downloadTextFile } from './utils/export';
import type { EditorMode } from './types';

const mode = ref<EditorMode>('edit');
const designRef = ref<InstanceType<typeof DesignCanvas> | null>(null);
const previewRef = ref<InstanceType<typeof PreviewCanvas> | null>(null);

const selectedCount = computed(() => designRef.value?.selectedCount ?? 0);
const objectCount = computed(() => designRef.value?.objectCount ?? 0);
const playing = computed(() => previewRef.value?.playing ?? false);
const progress = computed(() => previewRef.value?.progress ?? 0);

async function onImportFile(file: File) {
  try {
    await designRef.value?.importFile(file);
    message.success('导入成功');
  } catch (e) {
    message.error(e instanceof Error ? e.message : '导入失败');
  }
}

function onExportSvg() {
  const svg = designRef.value?.exportSvg() ?? null;
  if (!svg) {
    message.warning('无可导出内容');
    return;
  }
  downloadTextFile(buildExportFilename('svg'), svg, 'image/svg+xml');
}

function onExportJson() {
  const json = designRef.value?.exportJson() ?? null;
  if (!json) {
    message.warning('无可导出内容');
    return;
  }
  downloadTextFile(buildExportFilename('json'), json, 'application/json');
}

function startPreview() {
  const objects = designRef.value?.getObjectsForSimulation() ?? [];
  const paths = buildLaserPaths(objects);
  if (!paths.length) {
    message.warning('没有可模拟的路径');
    return;
  }
  previewRef.value?.load(paths);
  designRef.value?.setLocked(true);
  mode.value = 'preview';
  previewRef.value?.play();
}

function exitPreview() {
  previewRef.value?.pause();
  previewRef.value?.clear();
  designRef.value?.setLocked(false);
  mode.value = 'edit';
}
</script>

<template>
  <div class="laser-editor">
    <h2>激光雕刻画板</h2>
    <LaserToolbar
      :mode="mode"
      :selected-count="selectedCount"
      :object-count="objectCount"
      :playing="playing"
      :progress="progress"
      @add-rect="designRef?.addRect()"
      @add-ellipse="designRef?.addEllipse()"
      @add-line="designRef?.addLine()"
      @add-text="designRef?.addText()"
      @delete-selected="designRef?.deleteSelected()"
      @clear-all="designRef?.clearAll()"
      @import-file="onImportFile"
      @export-svg="onExportSvg"
      @export-json="onExportJson"
      @start-preview="startPreview"
      @exit-preview="exitPreview"
      @play="previewRef?.play()"
      @pause="previewRef?.pause()"
      @reset="previewRef?.reset(); previewRef?.play()"
    />
    <div class="stage" :class="{ preview: mode === 'preview' }">
      <DesignCanvas ref="designRef" class="layer design" />
      <PreviewCanvas
        v-show="mode === 'preview'"
        ref="previewRef"
        class="layer preview-layer"
      />
    </div>
  </div>
</template>

<style scoped>
.laser-editor {
  padding: 16px;
  background: #fff;
  min-height: calc(100vh - 48px);
}
.stage {
  position: relative;
  width: 900px;
  max-width: 100%;
  height: 560px;
}
.layer {
  position: absolute;
  inset: 0;
}
.preview-layer {
  z-index: 2;
  pointer-events: none;
}
.design {
  z-index: 1;
}
</style>
