<script setup lang="ts">
import { onMounted, ref, nextTick } from 'vue';
import { usePreviewCanvas } from '../composables/usePreviewCanvas';

const canvasRef = ref<HTMLCanvasElement | null>(null);
const preview = usePreviewCanvas(canvasRef);

defineExpose(preview);

onMounted(async () => {
  await nextTick();
  preview.clear();
});
</script>

<template>
  <canvas ref="canvasRef" class="preview-canvas" />
</template>

<style scoped>
.preview-canvas {
  display: block;
  border: 1px solid #d9d9d9;
}
</style>
