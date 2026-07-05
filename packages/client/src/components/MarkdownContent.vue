<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue';
import mermaid from 'mermaid';
import { renderMarkdown } from '../utils/markdown';

const props = defineProps<{
  content: string;
}>();

const containerRef = ref<HTMLElement | null>(null);
let mermaidInitialized = false;

function initMermaid() {
  if (!mermaidInitialized) {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
    });
    mermaidInitialized = true;
  }
}

async function renderDiagrams() {
  await nextTick();
  const container = containerRef.value;
  if (!container) return;

  const blocks = container.querySelectorAll('.mermaid-block:not([data-rendered])');
  if (blocks.length === 0) return;

  initMermaid();

  for (const [index, block] of Array.from(blocks).entries()) {
    const encoded = block.getAttribute('data-mermaid');
    if (!encoded) continue;

    const code = decodeURIComponent(encoded);
    const id = `mermaid-${Date.now()}-${index}`;

    try {
      const { svg } = await mermaid.render(id, code);
      block.innerHTML = svg;
      block.setAttribute('data-rendered', 'true');
      block.classList.add('mermaid-rendered');
    } catch {
      block.textContent = code;
      block.classList.add('mermaid-error');
    }
  }
}

watch(() => props.content, renderDiagrams);
onMounted(renderDiagrams);
</script>

<template>
  <div ref="containerRef" class="markdown" v-html="renderMarkdown(content)" />
</template>

<style scoped>
.markdown :deep(.mermaid-block) {
  margin: 0 0 0.75em;
  overflow-x: auto;
  text-align: center;
}

.markdown :deep(.mermaid-rendered svg) {
  max-width: 100%;
  height: auto;
}

.markdown :deep(.mermaid-error) {
  background: #fff2f0;
  border: 1px solid #ffccc7;
  border-radius: 6px;
  padding: 12px;
  font-family: monospace;
  font-size: 0.9em;
  white-space: pre-wrap;
  text-align: left;
}
</style>
