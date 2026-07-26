<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { message } from 'ant-design-vue';
import { api } from '../api';
import { getErrorMessage } from '../utils/error';
import SessionList from './components/SessionList.vue';
import MessageList from './components/MessageList.vue';
import Composer from './components/Composer.vue';
import KnowledgePanel from './components/KnowledgePanel.vue';
import { streamChatMessage } from './streamMessage';
import type { ChatMessage, ChatSession, ChatSourceRef } from './types';

const sessions = ref<ChatSession[]>([]);
const activeId = ref<string | null>(null);
const messages = ref<ChatMessage[]>([]);
const sessionsLoading = ref(false);
const messagesLoading = ref(false);
const sending = ref(false);

const composerDisabled = computed(() => !activeId.value || messagesLoading.value);

function isSoftNotice(text: string) {
  return text.includes('未命中知识库');
}

function mapStreamError(raw: string): string {
  if (raw.includes('503')) return 'AI 服务暂不可用，请稍后重试';
  if (raw.startsWith('HTTP ')) return `请求失败（${raw.replace('HTTP ', '')}）`;
  return raw || '发送失败';
}

async function loadSessions(preferId?: string | null) {
  sessionsLoading.value = true;
  try {
    sessions.value = await api.listChatSessions();
    const nextId =
      preferId && sessions.value.some((s) => s.id === preferId)
        ? preferId
        : activeId.value && sessions.value.some((s) => s.id === activeId.value)
          ? activeId.value
          : (sessions.value[0]?.id ?? null);
    if (nextId) {
      await selectSession(nextId);
    } else {
      activeId.value = null;
      messages.value = [];
    }
  } catch (err) {
    message.error(getErrorMessage(err) || '加载会话失败');
  } finally {
    sessionsLoading.value = false;
  }
}

async function selectSession(id: string) {
  activeId.value = id;
  messagesLoading.value = true;
  try {
    const session = await api.getChatSession(id);
    messages.value = session.messages ?? [];
  } catch (err) {
    message.error(getErrorMessage(err) || '加载消息失败');
    messages.value = [];
  } finally {
    messagesLoading.value = false;
  }
}

async function createSession() {
  try {
    const session = await api.createChatSession('新会话');
    sessions.value = [session, ...sessions.value];
    activeId.value = session.id;
    messages.value = session.messages ?? [];
  } catch (err) {
    message.error(getErrorMessage(err) || '新建会话失败');
  }
}

async function deleteSession(id: string) {
  try {
    await api.deleteChatSession(id);
    sessions.value = sessions.value.filter((s) => s.id !== id);
    if (activeId.value === id) {
      const next = sessions.value[0];
      if (next) {
        await selectSession(next.id);
      } else {
        activeId.value = null;
        messages.value = [];
      }
    }
    message.success('会话已删除');
  } catch (err) {
    message.error(getErrorMessage(err) || '删除会话失败');
  }
}

function tempId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function sendMessage(content: string) {
  const sessionId = activeId.value;
  if (!sessionId || sending.value) return;

  const now = new Date().toISOString();
  const userMsg: ChatMessage = {
    id: tempId('user'),
    role: 'user',
    content,
    createdAt: now,
  };
  const assistantMsg: ChatMessage = {
    id: tempId('assistant'),
    role: 'assistant',
    content: '',
    sources: null,
    createdAt: now,
  };
  messages.value = [...messages.value, userMsg, assistantMsg];
  sending.value = true;

  const assistantIndex = messages.value.length - 1;

  await streamChatMessage(sessionId, content, {
    onToken: (token) => {
      const current = messages.value[assistantIndex];
      if (!current) return;
      messages.value[assistantIndex] = { ...current, content: current.content + token };
    },
    onSources: (sources: ChatSourceRef[]) => {
      const current = messages.value[assistantIndex];
      if (!current) return;
      messages.value[assistantIndex] = { ...current, sources };
    },
    onDone: () => {
      sending.value = false;
      const current = messages.value[assistantIndex];
      if (current && isSoftNotice(current.content)) {
        /* 未命中仅展示文案，不弹错 */
      }
      void refreshSessionTitle(sessionId);
    },
    onError: (errMsg) => {
      sending.value = false;
      if (isSoftNotice(errMsg)) return;
      message.error(mapStreamError(errMsg));
    },
  });

  sending.value = false;
}

async function refreshSessionTitle(sessionId: string) {
  try {
    const session = await api.getChatSession(sessionId);
    const idx = sessions.value.findIndex((s) => s.id === sessionId);
    if (idx >= 0) {
      sessions.value[idx] = { ...sessions.value[idx], title: session.title, updatedAt: session.updatedAt };
    }
    if (session.messages?.length) {
      messages.value = session.messages;
    }
  } catch {
    /* ignore title refresh errors */
  }
}

onMounted(() => {
  void loadSessions();
});
</script>

<template>
  <div class="chat-view">
    <aside class="pane-left">
      <SessionList
        :sessions="sessions"
        :active-id="activeId"
        :loading="sessionsLoading"
        @select="selectSession"
        @create="createSession"
        @delete="deleteSession"
      />
    </aside>

    <section class="pane-center">
      <a-spin :spinning="messagesLoading" class="center-spin">
        <MessageList :messages="messages" :streaming="sending" />
      </a-spin>
      <Composer :disabled="composerDisabled" :loading="sending" @send="sendMessage" />
    </section>

    <aside class="pane-right">
      <KnowledgePanel />
    </aside>
  </div>
</template>

<style scoped>
.chat-view {
  display: flex;
  height: calc(100vh - 48px);
  margin: -24px;
  background: #fff;
  border-top: 1px solid #f0f0f0;
  overflow: hidden;
}

.pane-left {
  width: 240px;
  flex-shrink: 0;
  min-height: 0;
}

.pane-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.center-spin {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.center-spin :deep(.ant-spin-container) {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}

.pane-right {
  width: 280px;
  flex-shrink: 0;
  min-height: 0;
}
</style>
