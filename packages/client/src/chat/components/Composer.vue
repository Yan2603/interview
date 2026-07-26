<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  disabled?: boolean;
  loading?: boolean;
}>();

const emit = defineEmits<{
  send: [content: string];
}>();

const draft = ref('');

function submit() {
  const content = draft.value.trim();
  if (!content || props.disabled || props.loading) return;
  emit('send', content);
  draft.value = '';
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    submit();
  }
}
</script>

<template>
  <div class="composer">
    <a-textarea
      v-model:value="draft"
      :disabled="disabled || loading"
      :auto-size="{ minRows: 2, maxRows: 6 }"
      placeholder="输入问题，Enter 发送，Shift+Enter 换行"
      @keydown="onKeydown"
    />
    <div class="composer-actions">
      <a-button type="primary" :loading="loading" :disabled="disabled || !draft.trim()" @click="submit">
        发送
      </a-button>
    </div>
  </div>
</template>

<style scoped>
.composer {
  padding: 12px 16px 16px;
  border-top: 1px solid #f0f0f0;
  background: #fff;
  flex-shrink: 0;
}

.composer-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}
</style>
