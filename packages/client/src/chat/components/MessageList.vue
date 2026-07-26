<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import MarkdownContent from '../../components/MarkdownContent.vue';
import type { ChatMessage, ChatSourceRef } from '../types';

const props = defineProps<{
  messages: ChatMessage[];
  streaming?: boolean;
}>();

const listRef = ref<HTMLElement | null>(null);

async function scrollToBottom() {
  await nextTick();
  const el = listRef.value;
  if (el) el.scrollTop = el.scrollHeight;
}

watch(
  () => {
    const last = props.messages[props.messages.length - 1];
    return [
      props.messages.length,
      last?.content,
      last?.sources?.length ?? 0,
      props.streaming,
    ];
  },
  () => {
    void scrollToBottom();
  },
  { flush: 'post', immediate: true },
);

function documentSources(sources: ChatSourceRef[] | null | undefined) {
  return (sources ?? []).filter((s) => s.sourceType === 'document');
}

function questionSources(sources: ChatSourceRef[] | null | undefined) {
  return (sources ?? []).filter((s) => s.sourceType === 'question');
}

</script>

<template>
  <div ref="listRef" class="message-list">
    <a-empty v-if="messages.length === 0" description="选择或新建会话后开始提问" />
    <div
      v-for="(msg, index) in messages"
      :key="msg.id || `msg-${index}`"
      class="message-row"
      :class="msg.role"
    >
      <div class="bubble">
        <div class="role-label">{{ msg.role === 'user' ? '我' : '助手' }}</div>
        <div v-if="msg.role === 'user'" class="user-text">{{ msg.content }}</div>
        <MarkdownContent v-else :content="msg.content || (streaming ? '…' : '')" />

        <div
          v-if="msg.role === 'assistant' && msg.sources && msg.sources.length > 0"
          class="sources"
        >
          <div class="sources-title">引用来源</div>
          <ul v-if="questionSources(msg.sources).length" class="source-questions">
            <li v-for="(s, i) in questionSources(msg.sources)" :key="`q-${s.id}-${i}`">
              <router-link :to="`/questions/${s.id}`">{{ s.title }}</router-link>
              <span v-if="s.snippet" class="snippet-preview"> — {{ s.snippet }}</span>
            </li>
          </ul>
          <a-collapse v-if="documentSources(msg.sources).length" ghost>
            <a-collapse-panel
              v-for="(s, i) in documentSources(msg.sources)"
              :key="`${s.id}-${i}`"
              :header="s.title || '文档片段'"
            >
              <pre class="snippet-block">{{ s.snippet || '（无片段）' }}</pre>
            </a-collapse-panel>
          </a-collapse>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.message-list {
  flex: 1 1 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 16px 16px 28px;
  background: #fff;
  box-sizing: border-box;
}

.message-row {
  display: flex;
  margin-bottom: 16px;
}

.message-row:last-child {
  margin-bottom: 8px;
}

.message-row.user {
  justify-content: flex-end;
}

.message-row.assistant {
  justify-content: flex-start;
}

.bubble {
  max-width: min(720px, 92%);
  padding: 12px 14px;
  border-radius: 12px;
  background: #f5f5f5;
}

.message-row.user .bubble {
  background: #e6f4ff;
}

.role-label {
  font-size: 12px;
  color: #8c8c8c;
  margin-bottom: 6px;
}

.user-text {
  white-space: pre-wrap;
  word-break: break-word;
  color: #262626;
  font-size: 14px;
  line-height: 1.6;
}

.sources {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #e8e8e8;
}

.sources-title {
  font-size: 12px;
  font-weight: 600;
  color: #595959;
  margin-bottom: 6px;
}

.source-questions {
  margin: 0 0 8px;
  padding-left: 18px;
  font-size: 13px;
  color: #595959;
}

.source-questions a {
  color: #1677ff;
}

.snippet-preview {
  color: #8c8c8c;
}

:deep(.ant-collapse-header) {
  padding: 4px 0 !important;
  font-size: 13px;
}

:deep(.ant-collapse-content-box) {
  padding: 4px 0 8px !important;
}

.snippet-block {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  color: #595959;
  font-family: inherit;
}
</style>
