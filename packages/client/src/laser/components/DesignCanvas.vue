<script setup lang="ts">
import { onMounted, ref, nextTick } from 'vue';
import { useDesignCanvas } from '../composables/useDesignCanvas';

const canvasRef = ref<HTMLCanvasElement | null>(null);
const design = useDesignCanvas(canvasRef);

defineExpose(design);

onMounted(async () => {
  await nextTick();
  design.init();
});
</script>

<template>
  <canvas ref="canvasRef" class="design-canvas" />
</template>

<style scoped>
.design-canvas {
  display: block;
  border: 1px solid #d9d9d9;
  max-width: 100%;
}
</style>
